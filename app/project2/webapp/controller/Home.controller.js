sap.ui.define([
    "sap/ui/core/mvc/Controller",
      "sap/ui/core/Fragment",
      "sap/ui/mdc/p13n/StateUtil",
    "sap/m/MessageToast",
    "project2/utility/CustomUtility"
], (Controller, Fragment, StateUtil, MessageToast, CustomUtility) => {
    "use strict";

    return Controller.extend("project2.controller.Home", {
        onInit() {
             this._oNavContainer = this.byId("pageContainer");
            // Call the centralized controller's onInit
            CustomUtility.prototype.onInit.call(this);
        },

        	onSideNavButtonPress() {
			const oSideNavigation = this.byId("sideNavigation"),
				bExpanded = oSideNavigation.getExpanded();

			oSideNavigation.setExpanded(!bExpanded);
		},

       onItemSelect: function (oEvent) {
    const sKey = oEvent.getParameter("item").getKey();
    const oNavContainer = this.byId("pageContainer");

    const pageMap = {
        home: "root1",
        customers: "customersPage",
        opportunities: "opportunitiesPage",
        projects: "projectsPage",
        sapid: "sapidPage",
        employees: "employeesPage",
        overview: "overviewPage",
        requirements: "requirementsPage",
        bench: "benchPage",
        pendingProjects: "pendingProjectsPage",
        pendingOpportunities: "pendingOpportunitiesPage"
    };

    const sPageId = pageMap[sKey];

    if (!sPageId) {
        console.warn("No page mapped for key:", sKey);
        return;
    }

    oNavContainer.to(this.byId(sPageId));

    // Load fragment conditionally
    if (sKey === "customers" && !this._bCustomersLoaded) {
        this._bCustomersLoaded = true;
        const oCustomersPage = this.byId(sPageId);

       Fragment.load({
    id: this.getView().getId(),
                    name: "project2.view.fragments.Customers",
    controller: this
}).then(function (oFragment) {
            oCustomersPage.addContent(oFragment);

            const oTable = this.byId("Customers");
                    
                    // Ensure the table has the correct model
                    const oModel = this.getOwnerComponent().getModel();
                    if (oModel) {
                        oTable.setModel(oModel);
                    }
                    
                    // Initialize table-specific functionality
                    this.initializeTable("Customers");
                }.bind(this));
            } else if (sKey === "opportunities" && !this._bOpportunitiesLoaded) {
                this._bOpportunitiesLoaded = true;
                const oOpportunitiesPage = this.byId(sPageId);

                Fragment.load({
                    id: this.getView().getId(),
                    name: "project2.view.fragments.Opportunities",
                    controller: this
                }).then(function (oFragment) {
                    oOpportunitiesPage.addContent(oFragment);

                    const oTable = this.byId("Opportunities");
                    
                    // Ensure the table has the correct model
                    const oModel = this.getOwnerComponent().getModel();
                    if (oModel) {
                        oTable.setModel(oModel);
                    }
                    
                    // Initialize table-specific functionality
                    this.initializeTable("Opportunities");
                }.bind(this));
            } else if (sKey === "projects" && !this._bProjectsLoaded) {
                this._bProjectsLoaded = true;
                const oProjectsPage = this.byId(sPageId);

                Fragment.load({
                    id: this.getView().getId(),
                    name: "project2.view.fragments.Projects",
                    controller: this
                }).then(function (oFragment) {
                    oProjectsPage.addContent(oFragment);

                    const oTable = this.byId("Projects");
                    
                    // Ensure the table has the correct model
                    const oModel = this.getOwnerComponent().getModel();
                    if (oModel) {
                        oTable.setModel(oModel);
                    }
                    
                    // Initialize table-specific functionality
                    this.initializeTable("Projects");
                }.bind(this));
            } else if (sKey === "sapid" && !this._bSAPIdLoaded) {
                this._bSAPIdLoaded = true;
                const oSAPIdPage = this.byId(sPageId);

                Fragment.load({
                    id: this.getView().getId(),
                    name: "project2.view.fragments.SAPId",
                    controller: this
                }).then(function (oFragment) {
                    oSAPIdPage.addContent(oFragment);

                    const oTable = this.byId("SAPIdStatuses");
                    
                    // Ensure the table has the correct model
                    const oModel = this.getOwnerComponent().getModel();
                    if (oModel) {
                        oTable.setModel(oModel);
                    }
                    
                    // Initialize table-specific functionality
                    this.initializeTable("SAPIdStatuses");
                }.bind(this));
            } else if (sKey === "employees" && !this._bEmployeesLoaded) {
                this._bEmployeesLoaded = true;
                const oEmployeesPage = this.byId(sPageId);

                Fragment.load({
                    id: this.getView().getId(),
                    name: "project2.view.fragments.Employees",
                    controller: this
                }).then(function (oFragment) {
                    oEmployeesPage.addContent(oFragment);

                    const oTable = this.byId("Employees");
                    
                    // Ensure the table has the correct model
                    const oModel = this.getOwnerComponent().getModel();
                    if (oModel) {
                        oTable.setModel(oModel);
                    }
                    
                    // Initialize table-specific functionality
                    this.initializeTable("Employees");
                }.bind(this));
            }
        },

        // Include all methods from CustomUtility
        initializeTable: CustomUtility.prototype.initializeTable,
        _getPersonsBinding: CustomUtility.prototype._getPersonsBinding,
        _getSelectedContexts: CustomUtility.prototype._getSelectedContexts,
        _updateSelectionState: CustomUtility.prototype._updateSelectionState,
        _updatePendingState: CustomUtility.prototype._updatePendingState,
        onAddPress: CustomUtility.prototype.onAddPress,
        onDeletePress: CustomUtility.prototype.onDeletePress,
        onSaveChanges: CustomUtility.prototype.onSaveChanges,
        onCancelChanges: CustomUtility.prototype.onCancelChanges,
        onCopyToClipboard: CustomUtility.prototype.onCopyToClipboard,
        onUploadPress: CustomUtility.prototype.onUploadPress,
        onUploadTemplate: CustomUtility.prototype.onUploadTemplate,
        onDownloadTemplate: CustomUtility.prototype.onDownloadTemplate,
        onEditPress: CustomUtility.prototype.onEditPress,
        onAlignToggle: CustomUtility.prototype.onAlignToggle,
        _openPersonDialog: CustomUtility.prototype._openPersonDialog,
        onInlineAccept: CustomUtility.prototype.onInlineAccept,
        onInlineCancel: CustomUtility.prototype.onInlineCancel
    });
});