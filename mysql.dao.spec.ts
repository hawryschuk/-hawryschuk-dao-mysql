import { MysqlDAO } from './mysql.dao';
import { BusinessModel } from '@hawryschuk/redaction';
import { testBusinessModel } from '@hawryschuk/redaction/business.model.spec.exports';

testBusinessModel({
    title: 'Business Model : MySQL',
    business: new BusinessModel(MysqlDAO)
});
