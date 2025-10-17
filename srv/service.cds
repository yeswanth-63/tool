using db from '../db/schema';

service MyService {
  entity Customers      as projection on db.Customer;
  entity Opportunities  as projection on db.Opportunity;
  entity Projects       as projection on db.Project;
  entity Employees      as projection on db.Employee;
  entity SAPIdStatuses  as projection on db.SAPIdStatus;
  entity Assignments    as projection on db.Assignment;
}