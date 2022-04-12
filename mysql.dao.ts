import { Util } from '@hawryschuk/common';
import { DAO, Model } from '@hawryschuk/dao';
import * as  mysql from 'mysql';

export class MysqlDAO extends DAO {
    static DEFAULTS = { host: '192.168.1.108', user: 'root', password: '', database: 'hawryschuk_dao_mysql' };

    private connectionConfig: any;

    constructor(public models: any, public options = { connectionConfig: MysqlDAO.DEFAULTS }) {
        super(models);
    }

    private connection = mysql.createConnection(this.options.connectionConfig);

    private connected = new Promise((resolve, reject) => this.connection.connect(error => error ? reject(error) : resolve()));

    async end() {
        await this.connected;
        await new Promise((resolve, reject) => this.connection.end(error => error ? reject(error) : resolve()));
    };

    async query(sql: string, params = [] as string[]): Promise<any[]> {
        await this.connected;
        const results: any[] = await new Promise(async (resolve, reject) =>
            this.connection.query(sql, params, (error, results, fields) => {
                error
                    ? reject(error)
                    : resolve(results);
            }));
        return results;
    }

    ready$ = Promise
        .resolve(true)
        .then(() => this.connected)
        .then(async () => {
            const tables = (await this.query('show tables')) as any[];
            return tables.map(t => Object.values(t)[0]);
        })
        .then(async TableNames => {
            const missingTables = Object.keys(this.models).filter(table => !TableNames.includes(table));
            await Promise.all(
                missingTables.map(TableName =>
                    this.query(`create table ${TableName} (id tinytext, json longtext)`)));
        })
        .then(() => new Date);

    async create<M extends Model>(klass: any, data: M): Promise<M> {
        const object = await super.create(klass, data);
        await this.query(`insert into ${klass.name} set ?`, { id: object.id, json: JSON.stringify(object.POJO()) } as any);
        return object;
    }

    async delete(klass: any, id: string, fromObject?: boolean) {
        const object = await super.delete(klass, id, fromObject, true);
        await this.query(`delete from ${klass.name} where ? `, { id } as any);
        return object;
    }

    async update<M extends Model>(klass: any, id: string, data: any): Promise<M> {
        const object: M = await super.update(klass, id, data);
        await this.query(`update ${klass.name} set json = ? where id = ?`, [JSON.stringify(data), id]);
        return object;
    }

    async getOnline(klass: any, id = '', from = ''): Promise<Model | { [id: string]: Model }> {
        const doc2obj = async (doc: any): Promise<Model> => {
            doc = doc && { id: doc.id, ...(doc.json ? JSON.parse(doc.json) : doc) };
            const obj: Model = doc && new klass({ ...doc });
            obj && await obj.ready$;
            return obj;
        };
        const online = id
            ? await this
                .query(`select * from ${klass.name} where id = ?`, [id])
                .then(items => doc2obj(items[0]))
            : await this
                .query(`select * from ${klass.name}`)
                .then(items => Promise.all(items.map(doc2obj)))
                .then(models => models.reduce((all, model) => ({
                    ...all, [model.id]: model
                }), {}))
            ;
        console.log({ online });
        return online;
    }
}
