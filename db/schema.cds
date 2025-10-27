// prototype schema :  reply to this thread and suggest changes recommended
namespace db;

using {managed} from '@sap/cds/common';


type CustStatusEnum   : String enum {
    A = 'Active';
    I = 'Inactive';
    P = 'Prospect'
}

entity Vertical {
    key id   : Integer;
        name : String;

}

entity Customer : managed {
    key sapcustId        : String;
        sfdccustomerId   : Integer;
        name             : String(100);
        city             : String;
        country          : String;
        status           : CustStatusEnum;
        verticalId       : Integer;
        to_vertical      : Association to many Vertical
                               on to_vertical.id = $self.verticalId;

        to_Opportunities : Association to many Opportunity
                               on to_Opportunities.customerId = $self.sapcustId;
}


// -------------------- Opportunity --------------------


type ProbabilityEnum  : String enum {
    ProposalStage = '0%'; // Proposal Stage
    SoWSent = '33%'; // SoW is Sent
    SoWSigned = '85%'; // SoW is Signed
    PurchaseOrderReceived = '100%'; // Purchase Order is received
}


entity Opportunity : managed {

    key sapOpportunityId  : Integer;
        sfdcOpportunityId : String;
        probability       : ProbabilityEnum;
        salesSPOC         : String;
        deliverySPOC      : String;
        expectedStart     : Date;
        expectedEnd       : Date;
        customerId        : Integer;
        to_Customer       : Association to one Customer
                                on to_Customer.sapcustId = $self.customerId;
        to_Project        : Association to many Project
                                on to_Project.oppId = $self.sapOpportunityId;


}

// -------------------- Project --------------------

entity Project {

    key sapPId         : Integer;
        sfdcPId        : String;
        name           : String(256);
        startDate      : Date;
        endDate        : Date;
        pmo            : String;
        oppId          : Integer;

        to_Opportunity : Association to one Opportunity
                             on to_Opportunity.sapOpportunityId = $self.oppId;

        to_Demand      : Association to many Demand
                             on to_Demand.sapPId = $self.sapPId;

}

// Demand

entity Demand {
    key demandId   : Integer;
        skill      : String;
        band       : String;
        experience : Integer;
        sapPId     : Integer;
//         to_projects: association to one Project on to_projects.sapPId = $self.sapPId;
}


// SAPIDSTATUS
type SapStatusEnum    : String enum {
    A = 'Allocated';
    P = 'PreAllocated';
    B = 'Bench';
    R = 'Resigned';
}


entity SapIdStatus {
    key id     : Integer;
        status : SapStatusEnum;
}

// -------------------- Employee --------------------

type EmployeeTypeEnum : String enum {
    F = 'FullTime';
    C = 'Contract';
    I = 'Intern';
}

entity Employee {
    key ohrId          : Integer;
        mailid         : String;
        firstName      : String;
        lastName       : String;
        gender         : String;
        dob            : Date; // Date of Birth
        employeeType   : EmployeeTypeEnum;
        doj            : Date; // Date of Joining
        band           : String;
        role           : String;
        experience     : Integer;
        poc            : String;

        sapidstatusId  : Integer;
        to_sapidstatus : Association to one SapIdStatus
                             on to_sapidstatus.id = sapidstatusId;
}
