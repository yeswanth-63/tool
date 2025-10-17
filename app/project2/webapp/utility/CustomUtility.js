sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/mdc/p13n/StateUtil",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, StateUtil, JSONModel, MessageToast) {
    "use strict";

    return Controller.extend("project2.utility.CustomUtility", {
        onInit: function () {
            console.log("=== [Controller] onInit called ===");
            
            // Lightweight view state model for button enablement
            const oViewState = new JSONModel({ hasSelected: false, hasPendingChanges: false });
            this.getView().setModel(oViewState, "model");
            // Model to track row-level inline editing
            this.getView().setModel(new JSONModel({ editingPath: null, mode: null }), "edit");
        },

        // Initialize table-specific functionality when table is available
        initializeTable: function(sTableId) {
            // Try different table IDs if not specified
            const aTableIds = sTableId ? [sTableId] : ["Customers", "Opportunities", "Projects", "SAPIdStatuses", "Employees"];
            let oTable = null;
            
            for (const sId of aTableIds) {
                oTable = this.byId(sId);
                if (oTable) {
                    console.log("[Controller] Found table:", sId);
                    break;
                }
            }
            
            if (!oTable) {
                console.warn("[Controller] No table found, skipping initialization");
                return;
            }

            console.log("[Controller] Starting table initialization");

            // Wait for table initialization
            oTable.initialized().then(() => {
                console.log("[Controller] Table initialized");

                // Get the delegate
                const oDelegate = oTable.getControlDelegate();

                // Build initial state using delegate properties to align with MDC p13n
                oDelegate.fetchProperties(oTable)
                    .then((aProperties) => {
                        console.log("[Controller] Properties fetched:", aProperties);

                        // Prepare items for external state (visible true for all non-$ props)
                        const aItems = aProperties
                            .filter((p) => !p.name || !String(p.name).startsWith("$"))
                            .map((p) => ({
                                name: p.name || p.path,
                                visible: true
                            }));

                        const oExternalState = { items: aItems };

                        return StateUtil.applyExternalState(oTable, oExternalState);
                    })
                    .then(() => {
                        console.log("[Controller] External state applied; rebinding table");
                        // Ensure actions column exists for inline accept/cancel
                        const oDelegateAgain = oTable.getControlDelegate();
                        // Avoid duplicates by ID
                        if (!oTable.getColumns().some(function (c) { return c.getId && c.getId().endsWith("--col-actions"); })) {
                            oDelegateAgain.addItem(oTable, "_actions").then(function (oCol) {
                                oTable.addColumn(oCol);
                                oTable.rebind();
                            }).catch(function () { oTable.rebind(); });
                        } else {
                            oTable.rebind();
                        }
                    })
                    .catch((err) => {
                        console.error("[Controller] Error during initial column setup:", err);
                    });

                // Keep selection state in sync
                oTable.attachSelectionChange(this._updateSelectionState, this);
            });

            // Track pending changes on default model
            const oModel = this.getOwnerComponent().getModel();
            if (oModel && oModel.attachPropertyChange) {
                oModel.attachPropertyChange(this._updatePendingState, this);
            }
        },

        // Utilities
        _getPersonsBinding: function () {
            const oTable = this.byId("Customers");
            return oTable && oTable.getRowBinding && oTable.getRowBinding();
        },

        _getSelectedContexts: function () {
            const oTable = this.byId("Customers");
            return (oTable && oTable.getSelectedContexts) ? oTable.getSelectedContexts() : [];
        },

        _updateSelectionState: function () {
            const bHasSelection = this._getSelectedContexts().length > 0;
            this.getView().getModel("model").setProperty("/hasSelected", bHasSelection);
        },

        _updatePendingState: function () {
            const oModel = this.getOwnerComponent().getModel();
            const bHasChanges = !!(oModel && oModel.hasPendingChanges && oModel.hasPendingChanges());
            this.getView().getModel("model").setProperty("/hasPendingChanges", bHasChanges);
        },

        // Toolbar actions
        onAddPress: function () {
            // Create a transient row at the top and enter inline edit mode
            const oBinding = this._getPersonsBinding();
            if (!oBinding || !oBinding.create) {
                MessageToast.show("Create not available");
                return;
            }
            // Insert at top: use $orderby descending and rely on key; alternatively, use transient context and refresh
            const oCtx = oBinding.create({}, false, "$auto");
            // Ensure row shown on top by refreshing (ResponsiveTable shows newest last; rely on $orderby if needed)
            const sPath = oCtx.getPath();
            this.getView().getModel("edit").setData({ editingPath: sPath, mode: "create" });
            // Expose controller to delegate action buttons
            this.byId("Customers").data("controller", this);
        },

        onDeletePress: function () {
            const aCtx = this._getSelectedContexts();
            if (!aCtx.length) {
                MessageToast.show("Select rows to delete");
                return;
            }
            const deletes = aCtx.map(function (oCtx) {
                if (oCtx && oCtx.delete) {
                    return oCtx.delete("$auto");
                }
                return Promise.resolve();
            });
            Promise.all(deletes).then(() => {
                MessageToast.show("Deleted selected rows");
                this._updateSelectionState();
                this._updatePendingState();
            }).catch(function () {
                MessageToast.show("Delete failed");
            });
        },

        onSaveChanges: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (oModel && oModel.submitBatch) {
                oModel.submitBatch("$auto");
                this._updatePendingState();
                MessageToast.show("Changes submitted");
            }
        },

        onCancelChanges: function () {
            const oModel = this.getOwnerComponent().getModel();
            if (oModel && oModel.resetChanges) {
                oModel.resetChanges("$auto");
                this._updatePendingState();
                MessageToast.show("Changes discarded");
            }
        },

        onCopyToClipboard: function () {
            const aCtx = this._getSelectedContexts();
            if (!aCtx.length) {
                MessageToast.show("Nothing selected");
                return;
            }
            const aData = aCtx.map(function (c) { return c.getObject && c.getObject(); });
            const sText = JSON.stringify(aData, null, 2);
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(sText).then(function () {
                    MessageToast.show("Copied to clipboard");
                }).catch(function () {
                    MessageToast.show("Copy failed");
                });
            } else {
                MessageToast.show("Clipboard API not available");
            }
        },

        onUploadPress: function () {
            MessageToast.show("Upload not implemented");
        },

        onUploadTemplate: function () {
            // Generate a simple CSV template from current columns
            const oTable = this.byId("Customers");
            const aCols = (oTable && oTable.getColumns && oTable.getColumns()) || [];
            const aHeaders = aCols.map(function (c) { return c.getPropertyKey && c.getPropertyKey(); }).filter(Boolean);
            const sCsv = aHeaders.join(",") + "\n";
            const blob = new Blob([sCsv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "PersonsTemplate.csv"; a.click();
            URL.revokeObjectURL(url);
        },

        onDownloadTemplate: function () {
            this.onUploadTemplate();
        },

        onEditPress: function () {
            const aCtx = this._getSelectedContexts();
            if (!aCtx.length) {
                MessageToast.show("Select a row to edit");
                return;
            }
            const sPath = aCtx[0].getPath();
            this.getView().getModel("edit").setData({ editingPath: sPath, mode: "edit" });
            this.byId("Customers").data("controller", this);
        },

        onAlignToggle: function () {
            MessageToast.show("Alignment toggle");
        },

        // Dialog-based add/edit to avoid inline editing
        _openPersonDialog: function ({ mode, context }) {
            const oView = this.getView();
            const oTable = this.byId("Customers");

            // Determine fields from current columns to keep alignment with p13n
            const aFields = (oTable.getColumns ? oTable.getColumns() : [])
                .map(function (c) { return c.getPropertyKey && c.getPropertyKey(); })
                .filter(Boolean);
            if (!aFields.length) {
                // fallback
                Array.prototype.push.apply(aFields, ["ohrId", "firstName", "lastName", "email", "age"]);
            }

            const oPrefill = (mode === "edit" && context && context.getObject) ? context.getObject() : {};
            const oLocal = new JSONModel({
                title: mode === "edit" ? "Edit" : "Add",
                values: aFields.reduce(function (acc, k) { acc[k] = (oPrefill && oPrefill[k]) || ""; return acc; }, {})
            });

            sap.ui.require(["sap/m/Dialog", "sap/m/Button", "sap/m/Label", "sap/m/Input", "sap/m/VBox"],
                function (Dialog, Button, Label, Input, VBox) {
                    const aItems = [];
                    aFields.forEach(function (sKey) {
                        aItems.push(new Label({ text: sKey }));
                        aItems.push(new Input({ value: `{dlg>/values/${sKey}}` }));
                    });

                    const oVBox = new VBox({ items: aItems });

                    const oDlg = new Dialog({
                        title: "{dlg>/title}",
                        contentWidth: "420px",
                        content: [oVBox],
                        beginButton: new Button({
                            text: mode === "edit" ? "Save" : "Create",
                            press: () => {
                                const v = oDlg.getModel("dlg").getProperty("/values");
                                if (mode === "add") {
                                    const oBinding = this._getPersonsBinding();
                                    if (!oBinding || !oBinding.create) {
                                        MessageToast.show("Create not available");
                                        return;
                                    }
                                    oBinding.create(v, false, "$auto");
                                    this._updatePendingState();
                                    MessageToast.show("Row created");
                                } else if (mode === "edit" && context) {
                                    aFields.forEach(function (k) {
                                        if (context.setProperty) {
                                            context.setProperty(k, v[k]);
                                        }
                                    });
                                    this._updatePendingState();
                                    MessageToast.show("Row updated (use Save to persist)");
                                }
                                oDlg.close();
                            }
                        }),
                        endButton: new Button({ text: "Cancel", press: function () { oDlg.close(); } })
                    });
                    oDlg.addStyleClass("sapUiContentPadding");
                    oDlg.setModel(oLocal, "dlg");
                    oView.addDependent(oDlg);
                    oDlg.open();
                }.bind(this)
            );
        },

        onInlineAccept: function () {
            const oEdit = this.getView().getModel("edit").getData();
            const oModel = this.getOwnerComponent().getModel();
            if (!oEdit || !oEdit.editingPath) { return; }
            if (oEdit.mode === "create") {
                // Creation is already in binding; just submit immediately
                if (oModel && oModel.submitBatch) { oModel.submitBatch("$auto"); }
                MessageToast.show("Created");
            } else {
                if (oModel && oModel.submitBatch) { oModel.submitBatch("$auto"); }
                MessageToast.show("Updated");
            }
            this.getView().getModel("edit").setData({ editingPath: null, mode: null });
            this._updatePendingState();
        },

        onInlineCancel: function () {
            const oEdit = this.getView().getModel("edit").getData();
            const oModel = this.getOwnerComponent().getModel();
            if (!oEdit || !oEdit.editingPath) { return; }
            if (oEdit.mode === "create") {
                // Delete transient context
                const oCtx = oModel && oModel.getContextByPath && oModel.getContextByPath(oEdit.editingPath);
                if (oCtx && oCtx.delete) { oCtx.delete("$auto"); }
            } else {
                // Reset local changes on that context
                if (oModel && oModel.resetChanges) { oModel.resetChanges("$auto"); }
            }
            this.getView().getModel("edit").setData({ editingPath: null, mode: null });
            this._updatePendingState();
            MessageToast.show("Canceled");
        },

    });
});