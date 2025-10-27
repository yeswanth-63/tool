using db from '../db/schema';

service MyService {
  action GetNextCustomerId() returns String;
  entity Customers     as projection on db.Customer;
  entity Opportunities as projection on db.Opportunity;
  entity Projects      as projection on db.Project;
  entity Employees     as projection on db.Employee;
  entity Demands       as projection on db.Demand;
  entity SAPIdStatuses as projection on db.SapIdStatus;
  entity Verticals     as projection on db.Vertical;
}
