// prototype schema :  reply to this thread and suggest changes recommended
namespace db;

using { cuid, managed } from '@sap/cds/common';

// -------------------- Customer --------------------
 
entity Customer {
 
    key customerId : Integer;
 
    name           : String(100);
 
    createdAt      : Timestamp;
 
    status         : String(20);  // consider enum type later
 
    to_Opportunities : Association to many Opportunity on to_Opportunities.customerId = $self.customerId;
 
}

// -------------------- Opportunity --------------------
 
entity Opportunity {
 
    key oppId        : String(36); // CRM GUID
 
    customerId       : Integer;
 
    oppNumber        : String(50);
 
    name             : String(256);
 
    accountId        : String(36);
 
    stage            : String(50);
 
    probability      : Decimal(5,2);
 
    expectedStart    : Date;
 
    expectedEnd      : Date;
 
    createdAt        : Timestamp;
 
    updatedAt        : Timestamp;

    to_Customer      : Association to one Customer on to_Customer.customerId = $self.customerId;
 

 
}

// -------------------- Project --------------------
 
entity Project {
 
    key projectId    : String(50);
 
    oppId            : String(36);
 
    name             : String(256);
 
    status           : String(30);
 
    createdAt        : Timestamp;
 
    createdBy        : String(100); // projLead
 
    techStack        : String(100);

    to_Opportunity   : Association to one Opportunity on to_Opportunity.oppId = $self.oppId;
 
    to_Assignments   : Association to many Assignment on to_Assignments.projectId = $self.projectId;
 
}

// -------------------- Employee --------------------
 
entity Employee {
 
    key ohrId        : Integer;
 
    sapId            : String(50);
 
    firstName        : String(100);
 
    lastName         : String(100);
 
    email            : String(254);
 
    costCenter       : String(50);
 
    skillSet         : String(1000);
 
    status           : String(20);  // ACTIVE / INACTIVE
 
    manager          : String(20);  // ohrId of project manager

    to_SAPIdStatus   : Association to one SAPIdStatus on to_SAPIdStatus.sapId = $self.sapId;
 
    to_Assignments   : Association to many Assignment on to_Assignments.ohrId = $self.ohrId;
 
}

// -------------------- SAPIdStatus --------------------
 
entity SAPIdStatus {
 
    key sapId            : String(50);
 
    currentProjectId     : String(50); // latest active project or BENCH
 
    lastSeen             : Timestamp;

    
 
}

// -------------------- Assignment --------------------
 
entity Assignment {
 
    key assignmentId : String(36);
 
    projectId        : String(50);
 
    ohrId            : Integer;
 
    role             : String(100);
 
    startDate        : Date;
 
    endDate          : Date;
 
    allocationPct    : Integer; // 0–100
 
    state            : String(30); // ASSIGNED, PENDING_PROJECT_ID, BENCH
 
    lastUpdated      : Timestamp;

    to_Employee       : Association to one Employee on to_Employee.ohrId = $self.ohrId;
 
    to_Project        : Association to one Project on to_Project.projectId = $self.projectId;
 
}
 


type Status : String enum {
 
    ACTIVE;
 
    INACTIVE;
 
    BENCH;
 
    ASSIGNED;
 
    PENDING_PROJECT_ID;
 
}
 
 