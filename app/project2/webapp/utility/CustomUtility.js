sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/mdc/p13n/StateUtil",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "project2/utility/crud"
], function (Controller, StateUtil, JSONModel, MessageToast, Crud) {
    "use strict";
    
    // Fixed syntax error - removed duplicate oData declarations
    // Force refresh to clear browser cache

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
        initializeTable: function (sTableId) {
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

        // //on selection change functionalities.
        onSelectionChange: function (oEvent) {
            const oTable = oEvent.getSource();
            const sTableId = oTable.getId().split("--").pop(); // Extract ID without view prefix

            const buttonMap = {
                "Customers": { edit: "btnEdit_cus", delete: "btnDelete_cus" },
                "Employees": { edit: "Edit_emp", delete: "Delete_emp" },
                "Opportunities": { edit: "btnEdit_oppr", delete: "btnDelete_oppr" },
                "Projects": { edit: "btnEdit_proj", delete: "btnDelete_proj" },
                "SAPIdStatuses": { edit: "btnEdit_sap", delete: "btnDelete_sap" }
            };

            const config = buttonMap[sTableId];
            if (!config) {
                console.warn("No button mapping found for table:", sTableId);
                return;
            }

            const aSelectedContexts = oTable.getSelectedContexts();
            const bHasSelection = aSelectedContexts.length > 0;

            this.byId(config.edit)?.setEnabled(bHasSelection);
            this.byId(config.delete)?.setEnabled(bHasSelection);
        },
        // delete functionalities
        onDeletePress: function (oEvent) {
            const buttonMap = {
                "Customers": { edit: "btnEdit_cus", delete: "btnDelete_cus" },
                "Employees": { edit: "Edit_emp", delete: "Delete_emp" },
                "Opportunities": { edit: "btnEdit_oppr", delete: "btnDelete_oppr" },
                "Projects": { edit: "btnEdit_proj", delete: "btnDelete_proj" },
                "SAPIdStatuses": { edit: "btnEdit_sap", delete: "btnDelete_sap" }
            };

            // Determine which button triggered the event
            const sButtonId = oEvent.getSource().getId().split("--").pop();
            const sTableId = Object.keys(buttonMap).find(tableId => buttonMap[tableId].delete === sButtonId);

            if (!sTableId) {
                return sap.m.MessageBox.error("No table mapping found for delete button: " + sButtonId);
            }

            const oView = this.getView();
            const oTable = this.byId(sTableId);
            const oDeleteBtn = this.byId(buttonMap[sTableId].delete);
            const oEditBtn = this.byId(buttonMap[sTableId].edit);

            if (!oTable) {
                return sap.m.MessageBox.error(`Table '${sTableId}' not found.`);
            }

            const aSelectedContexts = oTable.getSelectedContexts?.() || [];

            if (aSelectedContexts.length === 0) {
                return sap.m.MessageBox.warning("Please select one or more entries to delete.");
            }

            sap.m.MessageBox.confirm("Are you sure you want to delete the selected entries?", {
                onClose: async (sAction) => {
                    if (sAction !== sap.m.MessageBox.Action.OK) {
                        return;
                    }

                    // Set busy state
                    oView.setBusy(true);
                    
                    try {
                        console.log("Starting delete operation for", aSelectedContexts.length, "contexts");
                        
                        // IMMEDIATELY clear busy state since we're using in-memory data
                        console.log("Clearing busy state immediately (in-memory data)");
                        oView.setBusy(false);
                        
                        // Delete contexts one by one with immediate UI update
                        let bAllDeleted = true;
                        let sErrorMessage = "";

                    // 🚨 OFFICIAL SAP APPROACH: Use oContext.delete().then() pattern
                    console.log(`=== OFFICIAL SAP DELETE START ===`);
                    console.log(`Selected contexts: ${aSelectedContexts.length}`);
                    
                    try {
                        // Use OData V4 update group so deletes are persisted server-side
                        console.log(`⏳ Deleting with update group "changesGroup"...`);
                        const oModel = this.getView().getModel();
                        const sGroupId = "changesGroup";
                        let queued = 0;
                        aSelectedContexts.forEach((oContext, index) => {
                            try {
                                const sPath = oContext.getPath && oContext.getPath();
                                console.log(`⏳ Queue DELETE ${index + 1}/${aSelectedContexts.length}: ${sPath}`);
                                oContext.delete(sGroupId);
                                queued++;
                            } catch (e) {
                                console.log("❌ Failed to queue delete:", e);
                            }
                        });
                        if (queued > 0 && oModel && oModel.submitBatch) {
                            await oModel.submitBatch(sGroupId);
                            console.log(`✅ Batch submitted for ${queued} deletes`);
                            bAllDeleted = true;
                        } else {
                            bAllDeleted = false;
                        }
                        
                    } catch (deleteError) {
                        console.log(`❌ Official delete failed:`, deleteError.message);
                        bAllDeleted = false;
                    }
                    
                    console.log(`=== DELETE OPERATION END ===`);
                    
                    // 🚨 OFFICIAL SAP PATTERN: Handle UI changes and refresh
                    console.log("🔄 Following official SAP pattern for UI updates...");
                    
                    try {
                        // Set UI changes state (official SAP pattern)
                        this._setUIChanges(true);
                        console.log("✅ UI changes state set");
                        
                        // Wait a moment for backend to process deletions
                        setTimeout(() => {
                            try {
                                // Call the existing initializeTable function to update the table
                                this.initializeTable(sTableId);
                                console.log("✅ Table updated successfully");
                                
                                // Reset UI changes state after successful update
                                this._setUIChanges(false);
                                console.log("✅ UI changes state reset");
                                
                            } catch (updateError) {
                                console.log("❌ Table update error:", updateError);
                                // Reset UI changes state on error
                                this._setUIChanges(false);
                            }
                        }, 500); // Small delay to allow backend processing
                        
                    } catch (updateError) {
                        console.log("❌ Table update error:", updateError);
                        // Reset UI changes state on error
                        this._setUIChanges(false);
                    }
                        
                    console.log("All delete operations completed. Success:", bAllDeleted);
                    
                    // Clear selection and force complete UI update
                    oTable.clearSelection();

                    // 🚨 SIMPLE: Just call the table update function again
                    try {
                        console.log("🔄 Final table update...");
                        this.initializeTable(sTableId);
                        console.log("✅ Final table update completed");
                    } catch (finalUpdateError) {
                        console.log("Final table update error:", finalUpdateError);
                    }

                        if (bAllDeleted) {
                            // All deletions successful
                        sap.m.MessageToast.show(`${sTableId} entries successfully deleted.`);
                            
                            // Refresh table to show updated data
                            const oBinding = oTable.getBinding("items");
                            if (oBinding) {
                                oBinding.refresh();
                            }
                    } else {
                            // Some deletions failed
                            console.error("Some deletions failed:", sErrorMessage);
                            sap.m.MessageBox.error("Some entries could not be deleted. Check console for details.");
                            
                            // Refresh table to restore original state
                            const oBinding = oTable.getBinding("items");
                            if (oBinding) {
                                oBinding.refresh();
                            }
                        }
                        
                    } catch (error) {
                        // Only show blocking error if delete batch actually failed
                        if (!bAllDeleted) {
                            console.error("Critical delete operation error:", error);
                            sap.m.MessageBox.error("Delete operation failed completely. Please try again.");
                            // Refresh table to restore state
                            const oBinding = oTable.getBinding("items");
                            if (oBinding) {
                                oBinding.refresh();
                            }
                        } else {
                            // Non-critical error after successful delete (e.g., UI refresh)
                            console.warn("Non-critical error after successful delete:", error);
                        }
                    } finally {
                        // ALWAYS clear busy state - this is critical!
                        console.log("Final busy state clear");
                        oView.setBusy(false);
                        
                        // Reset button states
                    oDeleteBtn?.setEnabled(false);
                    oEditBtn?.setEnabled(false);
                        
                        // Force UI refresh
                        setTimeout(() => {
                            oView.invalidate();
                        }, 100);
                    }
                }
            });
        },
        onEditPress: function (oEvent) {
            // Button mapping for all tables
            const buttonMap = {
                "Customers": { edit: "btnEdit_cus", delete: "btnDelete_cus", save: "saveButton", cancel: "cancelButton", add: "btnAdd" },
                "Employees": { edit: "Edit_emp", delete: "Delete_emp", save: "saveButton_emp", cancel: "cancelButton_emp", add: "btnAdd_emp" },
                "Opportunities": { edit: "btnEdit_oppr", delete: "btnDelete_oppr", save: "saveButton_oppr", cancel: "cancelButton_oppr", add: "btnAdd_oppr" },
                "Projects": { edit: "btnEdit_proj", delete: "btnDelete_proj", save: "saveButton_proj", cancel: "cancelButton_proj", add: "btnAdd_proj" },
                "SAPIdStatuses": { edit: "btnEdit_sap", delete: "btnDelete_sap", save: "saveButton_sap", cancel: "cancelButton_sap", add: "btnAdd_sap" }
            };

            // Determine which table this edit is for
            let sTableId = "Customers"; // Default fallback
            if (oEvent && oEvent.getSource) {
                const sButtonId = oEvent.getSource().getId().split("--").pop();
                sTableId = Object.keys(buttonMap).find(tableId => buttonMap[tableId].edit === sButtonId) || "Customers";
            }

            const oTable = this.byId(sTableId);
            const aSelectedContexts = oTable.getSelectedContexts();

            if (!aSelectedContexts.length) {
                sap.m.MessageToast.show("Please select one or more rows to edit.");
                return;
            }

            console.log(`=== [MULTI-EDIT] Starting edit for ${aSelectedContexts.length} rows ===`);

            // 🚀 MULTI-ROW EDITING: Process ALL selected rows
            const aEditingPaths = [];
            const aEditingContexts = [];

            aSelectedContexts.forEach((oContext, index) => {
            const oData = oContext.getObject();

            // Store original data for cancel
            oData._originalData = JSON.parse(JSON.stringify(oData));

                // Enable editable flags for fields
                oData.isEditable = true;
                
                // Track this context for multi-edit
                aEditingPaths.push(oContext.getPath());
                aEditingContexts.push(oContext);
                
                console.log(`[MULTI-EDIT] Row ${index + 1}: ${oContext.getPath()}`);
            });

            // Track ALL editing paths in edit model (comma-separated)
            const oEditModel = this.getView().getModel("edit");
            const sEditingPaths = aEditingPaths.join(",");
            oEditModel.setProperty("/editingPath", sEditingPaths);
            oEditModel.setProperty("/editingContexts", aEditingContexts.length);
            oEditModel.setProperty("/mode", "multi-edit");
            
            // 🚀 DEBUG: Log what we're setting
            console.log(`[MULTI-EDIT] Setting editing paths: ${sEditingPaths}`);
            console.log(`[MULTI-EDIT] Edit model data:`, oEditModel.getData());

            // Enable Save/Cancel buttons, disable Edit/Delete/Add for the specific table
            const config = buttonMap[sTableId];
            this.byId(config.save)?.setEnabled(true);
            this.byId(config.cancel)?.setEnabled(true);
            this.byId(config.edit)?.setEnabled(false);
            this.byId(config.delete)?.setEnabled(false);
            this.byId(config.add)?.setEnabled(false);

            // Refresh table so template Fields switch to Editable mode for ALL selected rows
            oTable.getBinding("items")?.refresh();
            
            // 🚀 FORCE REFRESH: Additional refresh to ensure edit mode is applied
            setTimeout(() => {
                oTable.getBinding("items")?.refresh();
                console.log(`[MULTI-EDIT] Forced refresh completed`);
            }, 100);
            
            sap.m.MessageToast.show(`${aSelectedContexts.length} rows are now in edit mode.`);
        },
        
        onAdd: function (oEvent) {
            // Button mapping for all tables
            const buttonMap = {
                "Customers": { edit: "btnEdit_cus", delete: "btnDelete_cus", save: "saveButton", cancel: "cancelButton", add: "btnAdd" },
                "Employees": { edit: "Edit_emp", delete: "Delete_emp", save: "saveButton_emp", cancel: "cancelButton_emp", add: "btnAdd_emp" },
                "Opportunities": { edit: "btnEdit_oppr", delete: "btnDelete_oppr", save: "saveButton_oppr", cancel: "cancelButton_oppr", add: "btnAdd_oppr" },
                "Projects": { edit: "btnEdit_proj", delete: "btnDelete_proj", save: "saveButton_proj", cancel: "cancelButton_proj", add: "btnAdd_proj" },
                "SAPIdStatuses": { edit: "btnEdit_sap", delete: "btnDelete_sap", save: "saveButton_sap", cancel: "cancelButton_sap", add: "btnAdd_sap" }
            };

            // Determine which table this add is for
            let sTableId = "Customers"; // Default fallback
            if (oEvent && oEvent.getSource) {
                const sButtonId = oEvent.getSource().getId().split("--").pop();
                sTableId = Object.keys(buttonMap).find(tableId => buttonMap[tableId].add === sButtonId) || "Customers";
            }

            const oTable = this.byId(sTableId);
            if (!oTable) { return; }
            const oBinding = oTable.getBinding && oTable.getBinding("items");
            if (!oBinding || !oBinding.create) {
                sap.m.MessageToast.show("Create not available for this table.");
                return;
            }
            try {
                const oContext = oBinding.create({}, false, "changesGroup");
                if (oContext && oContext.getPath) {
                    const oEditModel = this.getView().getModel("edit");
                    oEditModel.setProperty("/editingPath", oContext.getPath());
                    oEditModel.setProperty("/mode", "add");

                    // Enable Save/Cancel buttons, disable Edit/Delete/Add for the specific table
                    const config = buttonMap[sTableId];
                    this.byId(config.save)?.setEnabled(true);
                    this.byId(config.cancel)?.setEnabled(true);
                    this.byId(config.edit)?.setEnabled(false);
                    this.byId(config.delete)?.setEnabled(false);
                    this.byId(config.add)?.setEnabled(false);

                    oTable.getBinding("items")?.refresh();
                }
            } catch (e) {
                console.error("Error creating entry:", e);
                sap.m.MessageBox.error("Could not create a new entry.");
            }
        },
        onCancelButtonPress: function (oEvent) {
            const self = this; // Store reference to this
            
            // Button mapping for all tables
            const buttonMap = {
                "Customers": { edit: "btnEdit_cus", delete: "btnDelete_cus", save: "saveButton", cancel: "cancelButton", add: "btnAdd" },
                "Employees": { edit: "Edit_emp", delete: "Delete_emp", save: "saveButton_emp", cancel: "cancelButton_emp", add: "btnAdd_emp" },
                "Opportunities": { edit: "btnEdit_oppr", delete: "btnDelete_oppr", save: "saveButton_oppr", cancel: "cancelButton_oppr", add: "btnAdd_oppr" },
                "Projects": { edit: "btnEdit_proj", delete: "btnDelete_proj", save: "saveButton_proj", cancel: "cancelButton_proj", add: "btnAdd_proj" },
                "SAPIdStatuses": { edit: "btnEdit_sap", delete: "btnDelete_sap", save: "saveButton_sap", cancel: "cancelButton_sap", add: "btnAdd_sap" }
            };

            // Determine which table this cancel is for
            let sTableId = "Customers"; // Default fallback
            if (oEvent && oEvent.getSource) {
                const sButtonId = oEvent.getSource().getId().split("--").pop();
                sTableId = Object.keys(buttonMap).find(tableId => buttonMap[tableId].cancel === sButtonId) || "Customers";
            }

            sap.m.MessageBox.confirm(
                "Are you sure you want to cancel? Unsaved changes will be lost.",
                {
                    icon: sap.m.MessageBox.Icon.WARNING,
                    title: "Cancel Edit",
                    actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                    onClose: function (sAction) {
                        if (sAction === sap.m.MessageBox.Action.YES) {
                            // Inline the cancel logic to avoid scope issues
                            console.log("=== [Controller] Starting cancel operation ===");
                            
                            const oTable = self.byId(sTableId);
                            const oView = self.getView();
                            const oModel = oView.getModel(); // OData V4 model
                            const oEditModel = oView.getModel("edit");
                            const sPath = oEditModel.getProperty("/editingPath");
                            const sMode = oEditModel.getProperty("/mode");

                            console.log("Current editing path:", sPath);
                            console.log("Edit mode:", sMode);
                            console.log("Table ID:", sTableId);

                            if (!sPath) {
                                sap.m.MessageToast.show("No row is in edit mode.");
                                return;
                            }

                            // 🚀 MULTI-ROW CANCEL: Handle both single and multi-edit
                            let aContextsToCancel = [];
                            
                            if ((sMode === "multi-edit" || sMode === "add-multi") && sPath.includes(",")) {
                                // Multi cancel: resolve all paths from edit model to cancel/discard
                                const aPaths = sPath.split(",").filter(Boolean);
                                aContextsToCancel = aPaths.map(p => self._resolveContextByPath(oTable, p)).filter(Boolean);
                                console.log(`=== [MULTI-CANCEL] Canceling ${aContextsToCancel.length} rows ===`);
                            } else {
                                // Single row editing: resolve the specific context reliably
                                let oContext = self._resolveContextByPath(oTable, sPath);
                                if (!oContext) {
                                    const aSelectedContexts = oTable.getSelectedContexts();
                                    oContext = aSelectedContexts && aSelectedContexts.find(ctx => ctx.getPath() === sPath) || aSelectedContexts && aSelectedContexts[0];
                                }
                                if (!oContext) {
                                    sap.m.MessageToast.show("Unable to find edited context.");
                                    return;
                                }
                                aContextsToCancel = [oContext];
                                console.log(`=== [SINGLE-CANCEL] Canceling 1 row ===`);
                            }

                            try {
                                // 1. Debug the current state
                                console.log("=== [CANCEL] Current Edit State ===");
                                console.log("Edit Model:", oEditModel.getData());
                                console.log("Editing Path:", sPath);
                                console.log("Mode:", sMode);

                                // 2. Do not reset all model changes here; cancel is scoped per-context
                                //    We only delete the transient context or restore the single edited context below

                                // 3. Process ALL contexts to cancel
                                aContextsToCancel.forEach((oContext, index) => {
                                    console.log(`[MULTI-CANCEL] Processing row ${index + 1}: ${oContext.getPath()}`);
                                    
                                    try {
                                        const oData = oContext.getObject();
                                        
                                        // Handle new rows (transient or marked as new)
                                        if (oData._isNew || (typeof oContext.isTransient === "function" && oContext.isTransient())) {
                                            try {
                                                oContext.delete();
                                                console.log(`[MULTI-CANCEL] Deleted new/transient row ${index + 1}`);
                                            } catch (e) {
                                                console.log(`[MULTI-CANCEL] Error deleting transient row: ${e.message}`);
                                            }
                                            return; // Skip to next row
                                        }
                                        
                                        console.log(`[MULTI-CANCEL] Row ${index + 1} original data exists:`, !!oData._originalData);
                                        
                                        if (oData._originalData) {
                                            console.log(`[MULTI-CANCEL] Restoring original data for row ${index + 1}...`);
                                            const oOriginalData = oData._originalData;
                                            
                                            // Restore all original properties
                                            Object.keys(oOriginalData).forEach(sKey => {
                                                if (sKey !== '_originalData' && sKey !== 'isEditable' && sKey !== '_hasChanged') {
                                                    try {
                                                        let vValue = oOriginalData[sKey];
                                                        if (vValue instanceof Date) {
                                                            vValue = new Date(vValue.getTime());
                                                        }
                                                        oContext.setProperty(sKey, vValue);
                                                    } catch (propError) {
                                                        console.warn(`[MULTI-CANCEL] Error restoring property ${sKey}:`, propError);
                                                    }
                                                }
                                            });

                                            // Clean up the temporary properties
                                            delete oData._originalData;
                                            delete oData._hasChanged;
                                            delete oData.isEditable;
                                            
                                            console.log(`[MULTI-CANCEL] Restored original data for row ${index + 1}`);
                                        } else {
                                            console.warn(`[MULTI-CANCEL] No original data found for row ${index + 1}`);
                                        }
                                    } catch (contextError) {
                                        console.error(`[MULTI-CANCEL] Error processing context ${index + 1}:`, contextError);
                                    }
                                });

                                // 4. Clear edit state and reset OData model changes
                                oEditModel.setProperty("/editingPath", "");
                                oEditModel.setProperty("/mode", null);
                                
                                // 🚨 CRITICAL: Discard pending changes for edited contexts only
                                console.log("[MULTI-CANCEL] Discarding pending changes for edited contexts...");
                                try {
                                    const oModel = self.getView().getModel();
                                    if (oModel && oModel.getPendingChanges) {
                                        const aPendingChanges = oModel.getPendingChanges();
                                        console.log("[MULTI-CANCEL] Pending changes found:", aPendingChanges.length);
                                        
                                        // Discard changes for specific contexts
                                        aContextsToCancel.forEach((oContext, index) => {
                                            if (oContext && oContext.getPath) {
                                                const sContextPath = oContext.getPath();
                                                console.log(`[MULTI-CANCEL] Discarding changes for context ${index + 1}: ${sContextPath}`);
                                                
                                                // Try to discard changes for this specific context
                                                try {
                                                    if (oContext.reset) {
                                                        oContext.reset();
                                                        console.log(`[MULTI-CANCEL] Reset context ${index + 1}`);
                                                    }
                                                } catch (resetError) {
                                                    console.log(`[MULTI-CANCEL] Context reset failed for ${index + 1}:`, resetError);
                                                }
                                            }
                                        });
                                    }
                                } catch (discardError) {
                                    console.log("[MULTI-CANCEL] Error discarding pending changes:", discardError);
                                }

                                // 5. Clear selection and reset buttons for the specific table
                                oTable.clearSelection();
                                const config = buttonMap[sTableId];
                                // Disable Save/Cancel immediately after cancel
                                self.byId(config.save)?.setEnabled(false);
                                self.byId(config.cancel)?.setEnabled(false);
                                self.byId(config.edit)?.setEnabled(false); // Disable edit until new selection
                                self.byId(config.delete)?.setEnabled(false); // Disable delete until new selection
                                self.byId(config.add)?.setEnabled(true);

                                // 6. Reset binding changes per SAP pattern, then force table refresh to exit edit mode
                                try {
                                    // Reset pending changes at binding level
                                    const oBinding = oTable.getBinding("items");
                                    const oRowBinding = oTable.getRowBinding && oTable.getRowBinding();
                                    if (oBinding && oBinding.resetChanges) {
                                        oBinding.resetChanges();
                                        console.log("[MULTI-CANCEL] Binding changes reset");
                                    }
                                    if (oRowBinding && oRowBinding.resetChanges) {
                                        oRowBinding.resetChanges();
                                        console.log("[MULTI-CANCEL] Row binding changes reset");
                                    }

                                    // Force refresh all bindings
                                    if (oBinding) { oBinding.refresh(true); }
                                    if (oRowBinding) { oRowBinding.refresh(true); }
                                    
                                    // Force refresh the table itself
                                    if (oTable.refresh) {
                                        oTable.refresh();
                                    }
                                    
                                    // Clear selection to ensure clean state
                                    oTable.clearSelection();
                                    
                                    // Force a complete table rebind to exit edit mode
                                    setTimeout(() => {
                                        try {
                                            const oBinding2 = oTable.getBinding("items");
                                            if (oBinding2) {
                                                oBinding2.refresh();
                                            }
                                            console.log("[MULTI-CANCEL] Secondary refresh completed");
                                        } catch (e) {
                                            console.warn("[MULTI-CANCEL] Secondary refresh error:", e);
                                        }
                                    }, 100);
                                    
                                    console.log("[MULTI-CANCEL] Table refreshed and selection cleared");
                                } catch (refreshError) {
                                    console.warn("[MULTI-CANCEL] Error refreshing table:", refreshError);
                                }

                                // 7. Additional verification
                                setTimeout(() => {
                                    console.log("=== [Controller] Post-cancel state check ===");
                                    console.log("Edit Model after cancel:", oEditModel.getData());
                                    console.log("Save Button Enabled:", self.byId(config.save)?.getEnabled());
                                    console.log("Cancel Button Enabled:", self.byId(config.cancel)?.getEnabled());
                                }, 200);

                                // 8. 🚨 CRITICAL: Force refresh from database to show original data
                                const oBinding = oTable.getBinding("items");
                                if (oBinding) {
                                    // Force refresh from server to get original data
                                    oBinding.refresh(true); // true = force refresh from server
                                    console.log("[MULTI-CANCEL] Forced table refresh from database to show original data");
                                }
                                
                                // 9. Force exit edit mode completely
                                try {
                                    // Force all cells to exit edit mode
                                    const oInnerTable = oTable._oTable;
                                    if (oInnerTable && oInnerTable.getItems) {
                                        const aItems = oInnerTable.getItems();
                                        aItems.forEach(item => {
                                            if (item.getCells) {
                                                item.getCells().forEach(cell => {
                                                    if (cell.setEditable) {
                                                        cell.setEditable(false);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                    
                                    console.log("[MULTI-CANCEL] Forced exit from edit mode");
                                } catch (editModeError) {
                                    console.warn("[MULTI-CANCEL] Error forcing exit from edit mode:", editModeError);
                                }
                                
                                // 10. Additional refresh to ensure UI shows original data
                                setTimeout(() => {
                                    if (oBinding) {
                                        oBinding.refresh(true);
                                        console.log("[MULTI-CANCEL] Secondary refresh from database");
                                    }
                                }, 100);
                                
                                sap.m.MessageToast.show("Changes discarded successfully.");
                            } catch (error) {
                                console.error("Error during cancel operation:", error);
                                console.error("Error details:", {
                                    message: error.message,
                                    stack: error.stack,
                                    name: error.name
                                });
                                sap.m.MessageBox.error(`Error discarding changes: ${error.message}. Please check console for details.`);
                            }
                        }
                    }
                }
            );
        },

        _performCancel: function () {
            console.log("=== [Controller] Starting cancel operation ===");
            
                            const oTable = this.byId("Customers");
            const oView = this.getView();
            const oModel = oView.getModel(); // OData V4 model
            const oEditModel = oView.getModel("edit");
            const sPath = oEditModel.getProperty("/editingPath");

            console.log("Current editing path:", sPath);

            if (!sPath) {
                sap.m.MessageToast.show("No row is in edit mode.");
                return;
            }

            try {
                // 1. Debug the current state
                console.log("=== [CANCEL] Current Edit State ===");
                console.log("Edit Model:", oEditModel.getData());

                // 2. 🚨 CRITICAL: Discard pending changes first to allow refresh
                console.log("Discarding pending changes to allow refresh...");
                try {
                    if (oModel && oModel.getPendingChanges) {
                        const aPendingChanges = oModel.getPendingChanges();
                        console.log("Pending changes found:", aPendingChanges.length);
                        
                        // Try to discard all pending changes
                        if (aPendingChanges.length > 0) {
                            console.log("Discarding all pending changes...");
                            // Force discard changes by resetting the model
                            if (oModel.resetChanges) {
                                oModel.resetChanges();
                                console.log("Reset all pending changes");
                            }
                        }
                    }
                } catch (discardError) {
                    console.log("Error discarding pending changes:", discardError);
                }

                // 3. Find the edited context first
                            const aContexts = oTable.getSelectedContexts();
                const oContext = aContexts.find(ctx => ctx.getPath() === sPath) || aContexts[0];

                console.log("Found context:", oContext);

                if (oContext) {
                    // 🚨 CRITICAL: Discard OData changes for this specific context
                    try {
                        // Method 1: Try to reset the specific context
                        if (oContext.reset) {
                            oContext.reset();
                            console.log("Reset specific context to discard OData changes");
                        }
                        
                        // Method 2: Try to discard changes at the binding level
                        const oBinding = oTable.getBinding("items");
                        if (oBinding && oBinding.discardChanges) {
                            oBinding.discardChanges();
                            console.log("Discarded changes at binding level");
                        }
                    } catch (discardError) {
                        console.log("Error discarding OData changes:", discardError);
                    }
                    
                    // If transient (new row not yet submitted), delete the context to abandon creation
                    if (typeof oContext.isTransient === "function" && oContext.isTransient()) {
                        try {
                            oContext.delete();
                            console.log("Deleted transient context");
                        } catch (e) {
                            console.log("Error deleting transient context:", e);
                        }
                    } else {
                        // For existing rows, restore original data
                                const oData = oContext.getObject();
                        console.log("Original data exists:", !!oData._originalData);
                        
                                if (oData._originalData) {
                            console.log("Restoring original data for existing row...");
                            const oOriginalData = oData._originalData;
                            
                            // 🚨 CRITICAL: Force restore original data to context
                            Object.keys(oOriginalData).forEach(sKey => {
                                if (sKey !== '_originalData' && sKey !== 'isEditable' && sKey !== '_hasChanged') {
                                    try {
                                        oContext.setProperty(sKey, oOriginalData[sKey]);
                                        console.log(`Restored property ${sKey}:`, oOriginalData[sKey]);
                                    } catch (propError) {
                                        console.warn(`Failed to restore property ${sKey}:`, propError);
                                    }
                                }
                            });

                            // Clean up the temporary properties
                                    delete oData._originalData;
                            delete oData._hasChanged;
                                    delete oData.isEditable;
                            console.log("Cleaned up temporary properties");
                            
                            // 🚨 CRITICAL: Force UI update by triggering change event
                            try {
                                oContext.refresh();
                                console.log("Triggered context refresh after data restoration");
                                
                                // Also try to force update the table cells directly
                                const oInnerTable = oTable._oTable;
                                if (oInnerTable && oInnerTable.getItems) {
                                    const aItems = oInnerTable.getItems();
                                    const oRow = aItems.find(item => item.getBindingContext() === oContext);
                                    if (oRow && oRow.getCells) {
                                        oRow.getCells().forEach(cell => {
                                            const oBinding = cell.getBinding("value");
                                            if (oBinding && oBinding.getPath) {
                                                const sProp = oBinding.getPath();
                                                const vOriginalValue = oOriginalData[sProp];
                                                if (vOriginalValue !== undefined) {
                                                    cell.setValue(vOriginalValue);
                                                    console.log(`Forced cell update for ${sProp}:`, vOriginalValue);
                                                }
                                            }
                                        });
                                    }
                                }
                            } catch (refreshError) {
                                console.log("Context refresh failed:", refreshError);
                            }
                        } else {
                            console.log("No original data found - forcing refresh to discard changes");
                            // Force refresh to discard any pending changes
                            const oBinding = oTable.getBinding("items");
                            if (oBinding) {
                                oBinding.refresh();
                            }
                            
                            // Also try to reset the specific context if possible
                            try {
                                if (oContext.reset) {
                                    oContext.reset();
                                    console.log("Reset context to discard changes");
                                }
                            } catch (resetError) {
                                console.log("Context reset not available:", resetError);
                            }
                        }
                    }
                }

                // 4. Clear edit state using the working pattern
                            oEditModel.setProperty("/editingPath", "");
                oEditModel.setProperty("/mode", null);

                // 5. Clear selection and reset buttons
                oTable.clearSelection();
                this.byId("saveButton")?.setEnabled(false);
                this.byId("cancelButton")?.setEnabled(false);
                this.byId("btnEdit_cus")?.setEnabled(true);
                this.byId("btnDelete_cus")?.setEnabled(true);
                this.byId("btnAdd")?.setEnabled(true);

                // 6. 🚨 CRITICAL: Force refresh from database to show original data
                const oBinding = oTable.getBinding("items");
                if (oBinding) {
                    try {
                        // Method 1: Force refresh from server to get original data
                        oBinding.refresh(true); // true = force refresh from server
                        console.log("Forced table refresh from database to show original data");
                    } catch (refreshError) {
                        console.log("Refresh failed due to pending changes, trying alternative approach:", refreshError);
                        
                        // Alternative: Manually read data from database and set it back
                        if (oContext && oContext.getPath) {
                            const sContextPath = oContext.getPath();
                            console.log("Manually reading original data from database for:", sContextPath);
                            
                            // Try to read the original data from the server
                            oModel.read(sContextPath, {
                                success: function(oData) {
                                    console.log("Successfully read original data from database:", oData);
                                    
                                    // Set the original data back to the context
                                    Object.keys(oData).forEach(sKey => {
                                        if (sKey !== '_originalData' && sKey !== 'isEditable' && sKey !== '_hasChanged') {
                                            try {
                                                oContext.setProperty(sKey, oData[sKey]);
                                                console.log(`Restored property ${sKey} from database:`, oData[sKey]);
                                            } catch (propError) {
                                                console.warn(`Failed to restore property ${sKey}:`, propError);
                                            }
                                        }
                                    });
                                },
                                error: function(error) {
                                    console.log("Failed to read original data from database:", error);
                                }
                            });
                        }
                    }
                    
                    // Method 2: Try to clear cache and refresh
                    try {
                        if (oBinding.clearCache) {
                            oBinding.clearCache();
                            console.log("Cleared binding cache");
                        }
                        oBinding.refresh(true);
                        console.log("Refreshed after clearing cache");
                    } catch (cacheError) {
                        console.log("Cache clear not available:", cacheError);
                    }
                }
                
                // Also refresh the specific context from database
                if (oContext && oContext.refresh) {
                    try {
                        oContext.refresh(true); // true = force refresh from server
                        console.log("Refreshed specific context from database");
                    } catch (refreshError) {
                        console.log("Error refreshing context from database:", refreshError);
                    }
                }
                
                // Method 3: Force complete table re-render
                try {
                    const oInnerTable = oTable._oTable;
                    if (oInnerTable && oInnerTable.invalidate) {
                        oInnerTable.invalidate();
                        console.log("Invalidated inner table to force re-render");
                    }
                } catch (invalidateError) {
                    console.log("Table invalidation not available:", invalidateError);
                }
                
                // 7. 🚨 CRITICAL: Force discard all pending changes for this specific context
                try {
                    // Get the OData model and check for pending changes
                    const oModel = this.getView().getModel();
                    if (oModel) {
                        console.log("Attempting to discard OData changes...");
                        
                        // Method 1: Try to reset changes for this specific context
                        if (oContext && oContext.getPath) {
                            const sContextPath = oContext.getPath();
                            console.log("Discarding changes for context:", sContextPath);
                            
                            // Force refresh the specific context
                            oContext.refresh();
                            console.log("Refreshed specific context to discard changes");
                        }
                        
                        // Method 2: Try to use model's reset functionality
                        if (oModel.resetChanges) {
                            // Get all pending changes
                            const aPendingChanges = oModel.getPendingChanges ? oModel.getPendingChanges() : [];
                            console.log("Pending changes before discard:", aPendingChanges);
                            
                            // Try to reset only changes for this specific context
                            if (oContext && oContext.getPath) {
                                const sContextPath = oContext.getPath();
                                const aContextChanges = aPendingChanges.filter(change => 
                                    change.context && change.context.getPath && change.context.getPath() === sContextPath
                                );
                                
                                if (aContextChanges.length > 0) {
                                    console.log("Found changes for this context, attempting to discard:", aContextChanges);
                                    // Force refresh to discard changes
                                    oContext.refresh();
                                }
                            }
                        }
                    }
                } catch (modelError) {
                    console.log("Error accessing model changes:", modelError);
                }
                
                // 8. Additional refresh attempt to ensure UI shows original data from database
                setTimeout(() => {
                    if (oBinding) {
                        // Force refresh from server to ensure UI shows original data
                        oBinding.refresh(true);
                        console.log("Secondary refresh from database to show original data");
                    }
                    
                    // Also try to refresh the specific context again
                    if (oContext && oContext.refresh) {
                        try {
                            oContext.refresh(true);
                            console.log("Secondary context refresh from database");
                        } catch (error) {
                            console.log("Secondary context refresh failed:", error);
                        }
                    }
                }, 100);
                
                // 9. Final refresh attempt to ensure UI is completely updated
                setTimeout(() => {
                    if (oBinding) {
                        oBinding.refresh(true);
                        console.log("Final refresh from database to ensure original data is shown");
                    }
                    
                    // 🚨 CRITICAL: Force table re-render to show original data
                    try {
                        const oInnerTable = oTable._oTable;
                        if (oInnerTable) {
                            // Force complete re-render of the table
                            if (oInnerTable.rerender) {
                                oInnerTable.rerender();
                                console.log("Forced table re-render to show original data");
                            }
                            
                            // Also try to invalidate and refresh
                            if (oInnerTable.invalidate) {
                                oInnerTable.invalidate();
                                console.log("Invalidated table to force re-render");
                            }
                        }
                    } catch (rerenderError) {
                        console.log("Table re-render failed:", rerenderError);
                    }
                }, 300);

                // 7. Additional verification
                setTimeout(() => {
                    console.log("=== [Controller] Post-cancel state check ===");
                    console.log("Edit Model after cancel:", oEditModel.getData());
                }, 200);

                sap.m.MessageToast.show("Changes discarded successfully.");
            } catch (error) {
                console.error("Error during cancel operation:", error);
                sap.m.MessageBox.error("Error discarding changes. Please try again.");
            }
        },

        // Add the missing onInlineCancel method
        onInlineCancel: function (oEvent) {
            // This method handles inline cancel (if you have inline editing)
            const oTable = oEvent.getSource();
            const oContext = oTable.getBindingContext();
            
            if (oContext) {
                                const oData = oContext.getObject();
                                if (oData._originalData) {
                    // Restore original data
                    Object.keys(oData._originalData).forEach(key => {
                        if (key !== '_originalData' && key !== 'isEditable') {
                            oContext.setProperty(key, oData._originalData[key]);
                        }
                    });
                                    delete oData._originalData;
                                    delete oData.isEditable;
                }
            }
            
            // DON'T reset all changes - this would discard newly added rows
            console.log("Skipping global reset to preserve new rows");
        },

        // Debug method to check current edit state
        debugEditState: function () {
            const oView = this.getView();
            const oEditModel = oView.getModel("edit");
            const oModel = oView.getModel();
            
            console.log("=== [DEBUG] Current Edit State ===");
            console.log("Edit Model:", oEditModel.getData());
            console.log("Editing Path:", oEditModel.getProperty("/editingPath"));
            console.log("Mode:", oEditModel.getProperty("/mode"));
            
            // Try to find the correct table based on editing path
            const sPath = oEditModel.getProperty("/editingPath");
            let oTable = null;
            
            if (sPath) {
                // Determine table based on path
                if (sPath.includes("/Customers(")) {
                    oTable = this.byId("Customers");
                } else if (sPath.includes("/Employees(")) {
                    oTable = this.byId("Employees");
                } else if (sPath.includes("/Opportunities(")) {
                    oTable = this.byId("Opportunities");
                } else if (sPath.includes("/Projects(")) {
                    oTable = this.byId("Projects");
                } else if (sPath.includes("/SAPIdStatuses(")) {
                    oTable = this.byId("SAPIdStatuses");
                }
            }
            
            if (oTable) {
                console.log("Table Selection:", oTable.getSelectedContexts().length);
                console.log("Table ID:", oTable.getId());
            } else {
                console.log("Table Selection: No table found");
                console.log("Table ID: N/A");
            }
            
            console.log("Model Pending Changes:", oModel && oModel.hasPendingChanges ? oModel.hasPendingChanges() : "N/A");
            console.log("Save Button Enabled:", this.byId("saveButton")?.getEnabled());
            console.log("Cancel Button Enabled:", this.byId("cancelButton")?.getEnabled());
            console.log("Edit Button Enabled:", this.byId("btnEdit_cus")?.getEnabled());
        },

        // Test method to manually trigger cancel (for debugging)
        testCancel: function () {
            console.log("=== [TEST] Manual cancel test ===");
            console.log("Edit Model:", this.getView().getModel("edit").getData());
            this.aggressiveCancel();
            setTimeout(() => {
                console.log("=== [TEST] Post-cancel state ===");
                console.log("Edit Model after cancel:", this.getView().getModel("edit").getData());
            }, 500);
        },

        // Direct cancel without confirmation dialog (for testing)
        directCancel: function () {
            console.log("=== [Controller] Direct cancel (no confirmation) ===");
            this._performCancel();
        },
        
        // Test delete method for debugging
        testDeleteDirect: function () {
            console.log("=== [TEST] Direct delete test ===");
            const oView = this.getView();
            const oTable = this.byId("Customers");
            const aSelectedContexts = oTable.getSelectedContexts?.() || [];
            
            if (aSelectedContexts.length === 0) {
                console.log("No contexts selected for delete test");
                return;
            }
            
            console.log(`Testing delete for ${aSelectedContexts.length} contexts`);
            
            aSelectedContexts.forEach((oContext, index) => {
                console.log(`Test delete ${index + 1}:`, oContext.getPath());
                console.log("Context object:", oContext);
                console.log("Context methods:", Object.getOwnPropertyNames(oContext));
                
                // Test if delete method exists
                if (typeof oContext.delete === 'function') {
                    console.log("✅ Delete method exists");
                } else {
                    console.log("❌ Delete method does not exist");
                }
            });
        },

        // Official SAP pattern: Handle UI changes state
        _setUIChanges: function (bHasChanges) {
            try {
                const oView = this.getView();
                const oAppModel = oView.getModel("appView");
                
                if (oAppModel) {
                    oAppModel.setProperty("/hasUIChanges", bHasChanges);
                    console.log(`UI changes state set to: ${bHasChanges}`);
                } else {
                    console.log("App model not found, creating new one");
                    const oViewModel = new JSONModel({
                        busy: false,
                        hasUIChanges: bHasChanges,
                        usernameEmpty: false,
                        order: 0
                    });
                    oView.setModel(oViewModel, "appView");
                    console.log(`New app model created with UI changes: ${bHasChanges}`);
                }
            } catch (error) {
                console.log("Error setting UI changes state:", error);
            }
        },

        // Test cancel method for debugging
        testCancelDirect: function () {
            console.log("=== [TEST] Direct cancel test ===");
            const oView = this.getView();
            const oEditModel = oView.getModel("edit");
            const sPath = oEditModel.getProperty("/editingPath");
            const sMode = oEditModel.getProperty("/mode");
            
            console.log("Current edit state:", { sPath, sMode });
            
            if (!sPath) {
                sap.m.MessageToast.show("No row is in edit mode.");
                return;
            }
            
            // Force clear edit state
                            oEditModel.setProperty("/editingPath", "");
            oEditModel.setProperty("/mode", null);
            
            // DON'T reset all changes - this would discard newly added rows
            console.log("Skipping global reset to preserve new rows");
            
            // Force table refresh
            const oTable = this.byId("Customers");
            if (oTable) {
                oTable.clearSelection();
                const oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.refresh();
                }
            }
            
            // Reset buttons
            this.byId("saveButton")?.setEnabled(false);
            this.byId("cancelButton")?.setEnabled(false);
            this.byId("btnEdit_cus")?.setEnabled(false);
            this.byId("btnDelete_cus")?.setEnabled(false);
            this.byId("btnAdd")?.setEnabled(true);
            
            sap.m.MessageToast.show("Direct cancel completed");
        },

        // Simple cancel method following the exact pattern from helper file
        simpleCancel: function () {
            console.log("=== [Controller] Simple cancel using helper pattern ===");

            const oTable = this.byId("Customers");
            const oView = this.getView();
            const oModel = oView.getModel();
            const oEditModel = oView.getModel("edit");
            const sPath = oEditModel.getProperty("/editingPath");

            if (!sPath) {
                sap.m.MessageToast.show("No row is in edit mode.");
                return;
            }

            try {
                // Get the context
                const aContexts = oTable.getSelectedContexts();
                const oContext = aContexts.find(ctx => ctx.getPath() === sPath) || aContexts[0];

                if (oContext) {
                    const oData = oContext.getObject();
                    
                    // Restore original data exactly like the helper file
                    if (oData._originalData) {
                        const oOriginalData = oData._originalData;
                        
                        // Restore all original properties including dates
                        Object.keys(oOriginalData).forEach(sKey => {
                            if (sKey !== '_originalData' && sKey !== 'isEditable' && sKey !== '_hasChanged') {
                                // Special handling for date fields if needed
                                let vValue = oOriginalData[sKey];
                                if (vValue instanceof Date) {
                                    // Ensure we're setting a proper Date object
                                    vValue = new Date(vValue.getTime());
                                }
                                oContext.setProperty(sKey, vValue);
                            }
                        });

                        // Clean up the temporary properties
                        delete oData._originalData;
                        delete oData._hasChanged;
                        delete oData.isEditable;
                    }
                }

                // Clear edit state
                            oEditModel.setProperty("/editingPath", "");
                oEditModel.setProperty("/mode", null);

                // Clear selection and reset buttons
                oTable.clearSelection();
                this.byId("saveButton")?.setEnabled(false);
                this.byId("cancelButton")?.setEnabled(false);
                this.byId("btnEdit_cus")?.setEnabled(true);
                this.byId("btnDelete_cus")?.setEnabled(true);
                this.byId("btnAdd")?.setEnabled(true);

                // Force table refresh
                const oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.refresh();
                }

                sap.m.MessageToast.show("Changes discarded successfully.");
            } catch (error) {
                console.error("Error during simple cancel:", error);
                sap.m.MessageBox.error("Error discarding changes. Please try again.");
            }
        },

        // Enhanced cancel method that forces exit from edit mode
        forceExitEditMode: function () {
            const oTable = this.byId("Customers");
            const oView = this.getView();
            const oEditModel = oView.getModel("edit");
            
            try {
                console.log("=== [Controller] Force exiting edit mode ===");
                
                // 1. Clear all edit state in the edit model
                            oEditModel.setProperty("/editingPath", "");
                oEditModel.setProperty("/mode", null);
                
                // 2. Clear selection to force exit edit mode
                oTable.clearSelection();
                
                // 3. Disable all edit-related buttons
                this.byId("saveButton")?.setEnabled(false);
                this.byId("cancelButton")?.setEnabled(false);
                this.byId("btnEdit_cus")?.setEnabled(true);
                this.byId("btnDelete_cus")?.setEnabled(true);
                this.byId("btnAdd")?.setEnabled(true);
                
                // 4. Force table rebind to exit edit mode
                const oBinding = oTable.getBinding("items");
                if (oBinding) {
                    console.log("=== [Controller] Refreshing table binding ===");
                    oBinding.refresh();
                }
                
                // 5. Additional force refresh with multiple attempts
                setTimeout(() => {
                    if (oBinding) {
                        oBinding.refresh();
                    }
                    // Force another refresh to ensure edit mode is completely exited
                    setTimeout(() => {
                        if (oBinding) {
                            oBinding.refresh();
                        }
                    }, 100);
                }, 50);
                
                console.log("=== [Controller] Edit mode exit completed ===");
                
            } catch (error) {
                console.error("Error forcing exit from edit mode:", error);
            }
        },

        // Alternative cancel method - more aggressive approach
        aggressiveCancel: function () {
            console.log("=== [Controller] Aggressive cancel approach ===");

            const oTable = this.byId("Customers");
            const oView = this.getView();
            const oModel = oView.getModel();
            const oEditModel = oView.getModel("edit");
            
            try {
                // 1. DON'T reset OData model completely - this would discard newly added rows
                console.log("Skipping global reset to preserve new rows");
                
                // 2. Clear all edit state
                oEditModel.setProperty("/editingPath", "");
                oEditModel.setProperty("/mode", null);
                
                // 3. Clear selection
                oTable.clearSelection();
                
                // 4. Reset button states
                this.byId("saveButton")?.setEnabled(false);
                this.byId("cancelButton")?.setEnabled(false);
                this.byId("btnEdit_cus")?.setEnabled(true);
                this.byId("btnDelete_cus")?.setEnabled(true);
                this.byId("btnAdd")?.setEnabled(true);
                
                // 5. Force complete table rebind
                const oBinding = oTable.getBinding("items");
                if (oBinding) {
                    // Multiple refresh attempts
                    oBinding.refresh();
                    setTimeout(() => oBinding.refresh(), 50);
                    setTimeout(() => oBinding.refresh(), 150);
                    setTimeout(() => oBinding.refresh(), 300);
                }
                
                // 6. Force UI refresh
                oView.invalidate();
                
                console.log("=== [Controller] Aggressive cancel completed ===");
                
            } catch (error) {
                console.error("Error in aggressive cancel:", error);
            }
        },

        // 🚀 HELPERS: Row binding and context resolution
        _getRowBinding: function (oTable) {
            return (oTable && oTable.getRowBinding && oTable.getRowBinding())
                || (oTable && oTable.getBinding && (oTable.getBinding("items") || oTable.getBinding("rows")))
                || null;
        },
        _resolveContextByPath: function (oTable, sPath) {
            if (!oTable || !sPath) return null;
            const oBinding = this._getRowBinding(oTable);
            if (oBinding) {
                // Try to find among currently available contexts
                const aCtx = (typeof oBinding.getAllCurrentContexts === "function") ? oBinding.getAllCurrentContexts() : oBinding.getContexts();
                if (Array.isArray(aCtx) && aCtx.length) {
                    const hit = aCtx.find((c) => c && c.getPath && c.getPath() === sPath);
                    if (hit) return hit;
                }
            }
            // Fallback: look up via inner responsive table items
            const oInner = oTable && oTable._oTable;
            if (oInner && typeof oInner.getItems === "function") {
                const aItems = oInner.getItems();
                for (let i = 0; i < aItems.length; i++) {
                    const ctx = aItems[i].getBindingContext && aItems[i].getBindingContext();
                    if (ctx && ctx.getPath && ctx.getPath() === sPath) {
                        return ctx;
                    }
                }
            }
            return null;
        },
        onSaveButtonPress: async function (oEvent) {
            const GROUP_ID = "changesGroup"; // ✅ Define a consistent group ID

            // Button mapping for all tables
            const buttonMap = {
                "Customers": { edit: "btnEdit_cus", delete: "btnDelete_cus", save: "saveButton", cancel: "cancelButton", add: "btnAdd" },
                "Employees": { edit: "Edit_emp", delete: "Delete_emp", save: "saveButton_emp", cancel: "cancelButton_emp", add: "btnAdd_emp" },
                "Opportunities": { edit: "btnEdit_oppr", delete: "btnDelete_oppr", save: "saveButton_oppr", cancel: "cancelButton_oppr", add: "btnAdd_oppr" },
                "Projects": { edit: "btnEdit_proj", delete: "btnDelete_proj", save: "saveButton_proj", cancel: "cancelButton_proj", add: "btnAdd_proj" },
                "SAPIdStatuses": { edit: "btnEdit_sap", delete: "btnDelete_sap", save: "saveButton_sap", cancel: "cancelButton_sap", add: "btnAdd_sap" }
            };

            // Determine which table this save is for
            let sTableId = "Customers"; // Default fallback
            if (oEvent && oEvent.getSource) {
                const sButtonId = oEvent.getSource().getId().split("--").pop();
                sTableId = Object.keys(buttonMap).find(tableId => buttonMap[tableId].save === sButtonId) || "Customers";
            }

            const oTable = this.byId(sTableId);
            const oView = this.getView();
            const oModel = oView.getModel(); // OData V4 model
            const oEditModel = oView.getModel("edit");
            const sPath = oEditModel.getProperty("/editingPath");
            const sMode = oEditModel.getProperty("/mode");

            if (!sPath) {
                sap.m.MessageToast.show("No row is in edit mode.");
                return;
            }

            // 🚀 MULTI-ROW SAVE: Handle multi-edit and multi-add
            let aContextsToSave = [];
            
            if (sMode === "multi-edit" && sPath.includes(",")) {
                // Multi-row editing: get all selected contexts
                const aSelectedContexts = oTable.getSelectedContexts();
                aContextsToSave = aSelectedContexts;
                console.log(`=== [MULTI-SAVE] Saving ${aContextsToSave.length} rows ===`);
            } else if (sMode === "add-multi" && sPath.includes(",")) {
                // Multi-add: resolve all transient contexts from the stored paths
                const aPaths = sPath.split(",").filter(Boolean);
                aContextsToSave = aPaths.map(p => this._resolveContextByPath(oTable, p)).filter(Boolean);
                console.log(`=== [MULTI-SAVE][ADD] Saving ${aContextsToSave.length} new rows ===`);
            } else {
                // Single row editing: find the specific context
                let oContext = this._resolveContextByPath(oTable, sPath);
                if (!oContext) {
                    // As a fallback, use first selected
                    const aSelectedContexts = oTable.getSelectedContexts();
                    oContext = aSelectedContexts && aSelectedContexts[0];
                }
            if (!oContext) {
                sap.m.MessageBox.error("Unable to find edited context.");
                return;
                }
                aContextsToSave = [oContext];
                console.log(`=== [SINGLE-SAVE] Saving 1 row ===`);
            }

            this.getView().setBusy(true);

            try {
                // 🔹 Push changed values from table cells into ALL contexts
                const oInnerTable = oTable._oTable; // internal responsiveTable of MDC
                if (oInnerTable && oInnerTable.getItems) {
                    const aItems = oInnerTable.getItems();
                    
                    // Process each context to save
                    aContextsToSave.forEach((oContext, index) => {
                        const sContextPath = oContext.getPath();
                        const oRow = aItems.find(item => item.getBindingContext().getPath() === sContextPath);
                        
                    if (oRow) {
                            console.log(`[MULTI-SAVE] Processing row ${index + 1}: ${sContextPath}`);
                        oRow.getCells().forEach((cell) => {
                            const oBinding = cell.getBinding("value");
                            if (oBinding?.getPath && cell.getValue) {
                                const sProp = oBinding.getPath();
                                const vVal = cell.getValue();
                                oContext.setProperty(sProp, vVal, GROUP_ID); // ✅ Assign to group
                            }
                        });
                        
                        // 🚨 CRITICAL: Remove client-side only properties before sending to server
                        const oData = oContext.getObject();
                        if (oData) {
                            delete oData._isNew;
                            delete oData.isEditable;
                            delete oData._hasChanged;
                            delete oData._originalData;
                            console.log(`[MULTI-SAVE] Cleaned client-side properties for row ${index + 1}`);
                        }
                    }
                    });
                }

                // 🔹 Submit batch with group ID
                await oModel.submitBatch(GROUP_ID);

                // 🔹 Clear the original data after successful save for ALL contexts
                aContextsToSave.forEach((oContext, index) => {
                    const oData = oContext.getObject();
                    if (oData._originalData) {
                        delete oData._originalData;
                    }
                    delete oData.isEditable;
                    delete oData._isNew; // Clear new row marker
                    console.log(`[MULTI-SAVE] Cleared original data for row ${index + 1}`);
                });

                sap.m.MessageToast.show("Changes saved successfully.");

                // 🔹 Refresh table
                oTable.getBinding("items")?.refresh();

                // Reset edit state and button states for the specific table
                oEditModel.setProperty("/editingPath", "");
                oEditModel.setProperty("/mode", null);
                
                // Clear selection to make table look normal
                oTable.clearSelection();
                
                const config = buttonMap[sTableId];
                this.byId(config.save)?.setEnabled(false);
                this.byId(config.cancel)?.setEnabled(false);
                this.byId(config.edit)?.setEnabled(false); // Disable edit until new selection
                this.byId(config.delete)?.setEnabled(false); // Disable delete until new selection
                this.byId(config.add)?.setEnabled(true);
                
                // Force table refresh to exit edit mode completely
                const oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.refresh();
                }

            } catch (err) {
                console.error("Error saving changes:", err);
                sap.m.MessageBox.error("Error saving changes. Check console for details.");
            } finally {
                this.getView().setBusy(false);
            }
        },

        // 🚀 TEMPLATE DOWNLOADER (Headers Only CSV)
        onTemplateDownload: function (oEvent) {
            console.log("=== [TEMPLATE-DOWNLOAD] Function called ===");
            console.log("Event object:", oEvent);
            console.log("Event source:", oEvent.getSource());
            
            // Simple test first
            sap.m.MessageToast.show("CSV Export button clicked!");
            
            try {
                // Determine which table this export is for
                let sTableId = "Customers"; // Default fallback
                if (oEvent && oEvent.getSource) {
                    const sButtonId = oEvent.getSource().getId().split("--").pop();
                    console.log("Button ID:", sButtonId);
                    // Map button IDs to table IDs
                    if (sButtonId.includes("cus")) sTableId = "Customers";
                    else if (sButtonId.includes("emp")) sTableId = "Employees";
                    else if (sButtonId.includes("oppr")) sTableId = "Opportunities";
                    else if (sButtonId.includes("proj")) sTableId = "Projects";
                    else if (sButtonId.includes("sap")) sTableId = "SAPIdStatuses";
                }

                console.log("Table ID:", sTableId);
                const oTable = this.byId(sTableId);
                if (!oTable) {
                    console.error("Table not found:", sTableId);
                    sap.m.MessageBox.error(`Table '${sTableId}' not found.`);
                    return;
                }

                console.log(`=== [CSV-EXPORT] Starting CSV export for ${sTableId} ===`);

                // 🚀 MDC TABLE SPECIFIC: Get data using binding contexts
                let aData = [];
                let aHeaders = [];
                let aPropertyKeys = [];

                console.log("Using MDC Table binding approach...");
                
                // 🚀 IMPROVED DATA DETECTION: Try multiple approaches
                let oBinding = null;
                let aContexts = [];
                
                // Method 1: Try standard binding
                try {
                    oBinding = oTable.getBinding("items");
                    if (oBinding) {
                        aContexts = oBinding.getContexts();
                        console.log("Standard binding found, contexts:", aContexts.length);
                    }
                } catch (e) {
                    console.log("Standard binding failed:", e.message);
                }
                
                // Method 2: Try alternative binding paths
                if (!oBinding || aContexts.length === 0) {
                    try {
                        oBinding = oTable.getBinding("rows");
                        if (oBinding) {
                            aContexts = oBinding.getContexts();
                            console.log("Rows binding found, contexts:", aContexts.length);
                        }
                    } catch (e) {
                        console.log("Rows binding failed:", e.message);
                    }
                }
                
                // Method 3: Try to get data from table's inner table
                if (!oBinding || aContexts.length === 0) {
                    try {
                        const oInnerTable = oTable._oTable;
                        if (oInnerTable && oInnerTable.getBinding) {
                            oBinding = oInnerTable.getBinding("items");
                            if (oBinding) {
                                aContexts = oBinding.getContexts();
                                console.log("Inner table binding found, contexts:", aContexts.length);
                            }
                        }
                    } catch (e) {
                        console.log("Inner table binding failed:", e.message);
                    }
                }
                
                // Method 4: Try to get data from model directly
                if (!oBinding || aContexts.length === 0) {
                    try {
                        const oModel = oTable.getModel();
                        if (oModel) {
                            console.log("Model found, trying to get data directly...");
                            // This is a fallback - we'll create dummy data structure
                            aContexts = [{ getObject: () => ({}) }];
                            console.log("Using fallback data structure");
                        }
                    } catch (e) {
                        console.log("Model access failed:", e.message);
                    }
                }
                
                if (!oBinding && aContexts.length === 0) {
                    console.error("No binding found with any method");
                    sap.m.MessageBox.error("No data available to export. Please ensure the table has data loaded.");
                    return;
                }
                
                console.log("Final contexts found:", aContexts.length);

                // Get column information from MDC Table
                const aColumns = oTable.getColumns();
                console.log("Columns found:", aColumns.length);
                
                aColumns.forEach((oColumn) => {
                    const sHeader = oColumn.getHeader();
                    const sPropertyKey = oColumn.getPropertyKey();
                    console.log("Column:", sHeader, "Property:", sPropertyKey);
                    if (sHeader && sPropertyKey) {
                        aHeaders.push(sHeader);
                        aPropertyKeys.push(sPropertyKey);
                    }
                });

                console.log("Headers:", aHeaders);
                console.log("Property Keys:", aPropertyKeys);

                // Extract data from contexts
                aContexts.forEach((oContext, index) => {
                    const oData = oContext.getObject();
                    console.log(`Row ${index + 1} data:`, oData);
                    const aRowData = [];

                    aPropertyKeys.forEach((sKey) => {
                        let sValue = oData[sKey] || "";
                        // Escape CSV values
                        if (typeof sValue === "string" && (sValue.includes(",") || sValue.includes('"') || sValue.includes("\n"))) {
                            sValue = '"' + sValue.replace(/"/g, '""') + '"';
                        }
                        aRowData.push(sValue);
                    });

                    aData.push(aRowData);
                });

                console.log("Headers:", aHeaders);
                console.log("Property Keys:", aPropertyKeys);
                console.log("Data rows:", aData.length);

                if (aData.length === 0) {
                    sap.m.MessageBox.warning("No data to export.");
                    return;
                }

                // Create CSV content
                let sCSVContent = aHeaders.join(",") + "\n";
                console.log("CSV Headers:", sCSVContent);

                aData.forEach((aRowData, index) => {
                    sCSVContent += aRowData.join(",") + "\n";
                });

                console.log("Final CSV content length:", sCSVContent.length);

                // Create and download file
                const sFileName = `${sTableId}_export_${new Date().toISOString().split('T')[0]}.csv`;
                console.log("File name:", sFileName);
                
                const oBlob = new Blob([sCSVContent], { type: "text/csv;charset=utf-8;" });
                console.log("Blob created, size:", oBlob.size);
                
                const oLink = document.createElement("a");
                
                if (oLink.download !== undefined) {
                    const sUrl = URL.createObjectURL(oBlob);
                    console.log("URL created:", sUrl);
                    oLink.setAttribute("href", sUrl);
                    oLink.setAttribute("download", sFileName);
                    oLink.style.visibility = "hidden";
                    document.body.appendChild(oLink);
                    console.log("Link added to DOM, clicking...");
                    oLink.click();
                    document.body.removeChild(oLink);
                    URL.revokeObjectURL(sUrl);
                    console.log("Download triggered");
                } else {
                    console.error("Download not supported");
                    sap.m.MessageBox.error("Download not supported in this browser.");
                    return;
                }
            } catch (error) {
                console.error("Template download error:", error);
                sap.m.MessageBox.error("Failed to download template: " + error.message);
            }
        },

        // 🚀 TEMPLATE DOWNLOADER (Headers Only CSV)
        onTemplateDownload: function (oEvent) {
            console.log("=== [TEMPLATE-DOWNLOAD] Function called ===");
            console.log("Event object:", oEvent);
            console.log("Event source:", oEvent.getSource());
            
            // Simple test first
            sap.m.MessageToast.show("Template Download button clicked!");
            
            try {
                // Determine which table this template is for
                let sTableId = "Customers"; // Default fallback
                if (oEvent && oEvent.getSource) {
                    const sButtonId = oEvent.getSource().getId().split("--").pop();
                    console.log("Button ID:", sButtonId);
                    // Map button IDs to table IDs
                    if (sButtonId.includes("cus")) sTableId = "Customers";
                    else if (sButtonId.includes("emp")) sTableId = "Employees";
                    else if (sButtonId.includes("oppr")) sTableId = "Opportunities";
                    else if (sButtonId.includes("proj")) sTableId = "Projects";
                    else if (sButtonId.includes("sap")) sTableId = "SAPIdStatuses";
                }

                console.log("Table ID:", sTableId);
                const oTable = this.byId(sTableId);
                if (!oTable) {
                    console.error("Table not found:", sTableId);
                    sap.m.MessageBox.error(`Table '${sTableId}' not found.`);
                    return;
                }

                console.log(`=== [TEMPLATE-DOWNLOAD] Starting template download for ${sTableId} ===`);

                // Get column information from MDC Table
                const aColumns = oTable.getColumns();
                console.log("Columns found:", aColumns.length);
                
                const aHeaders = [];
                const aPropertyKeys = [];

                aColumns.forEach((oColumn) => {
                    const sHeader = oColumn.getHeader();
                    const sPropertyKey = oColumn.getPropertyKey();
                    console.log("Column:", sHeader, "Property:", sPropertyKey);
                    if (sHeader && sPropertyKey) {
                        aHeaders.push(sHeader);
                        aPropertyKeys.push(sPropertyKey);
                    }
                });

                console.log("Headers:", aHeaders);
                console.log("Property Keys:", aPropertyKeys);

                if (aHeaders.length === 0) {
                    sap.m.MessageBox.warning("No columns found to create template.");
                    return;
                }

                // Create CSV template with headers only (no sample data)
                let sCSVContent = aHeaders.join(",") + "\n";
                console.log("Template CSV Headers:", sCSVContent);

                // Create and download template file
                const sFileName = `${sTableId}_template_${new Date().toISOString().split('T')[0]}.csv`;
                console.log("Template file name:", sFileName);
                
                const oBlob = new Blob([sCSVContent], { type: "text/csv;charset=utf-8;" });
                console.log("Template blob created, size:", oBlob.size);
                
                const oLink = document.createElement("a");
                
                if (oLink.download !== undefined) {
                    const sUrl = URL.createObjectURL(oBlob);
                    console.log("Template URL created:", sUrl);
                    oLink.setAttribute("href", sUrl);
                    oLink.setAttribute("download", sFileName);
                    oLink.style.visibility = "hidden";
                    document.body.appendChild(oLink);
                    console.log("Template link added to DOM, clicking...");
                    oLink.click();
                    document.body.removeChild(oLink);
                    URL.revokeObjectURL(sUrl);
                    console.log("Template download triggered");
                } else {
                    console.error("Download not supported");
                    sap.m.MessageBox.error("Download not supported in this browser.");
                    return;
                }

                sap.m.MessageToast.show(`Template downloaded successfully: ${aHeaders.length} columns`);

            } catch (error) {
                console.error("Template download error:", error);
                sap.m.MessageBox.error("Failed to download template: " + error.message);
            }
        },

        // 🚀 ADD NEW ROW FUNCTIONALITY
        onAdd: function (oEvent) {
            console.log("=== [ADD] Function called ===");
            
            try {
                // Determine which table this add is for
                let sTableId = "Customers"; // Default fallback
                if (oEvent && oEvent.getSource) {
                    const sButtonId = oEvent.getSource().getId().split("--").pop();
                    console.log("Add Button ID:", sButtonId);
                    // Map button IDs to table IDs
                    if (sButtonId.includes("cus") || sButtonId === "btnAdd") sTableId = "Customers";
                    else if (sButtonId.includes("emp") || sButtonId === "btnAdd_emp") sTableId = "Employees";
                    else if (sButtonId.includes("oppr") || sButtonId === "btnAdd_oppr") sTableId = "Opportunities";
                    else if (sButtonId.includes("proj") || sButtonId === "btnAdd_proj") sTableId = "Projects";
                    else if (sButtonId.includes("sap") || sButtonId === "btnAdd_sap") sTableId = "SAPIdStatuses";
                }

                console.log("Table ID:", sTableId);
                const oTable = this.byId(sTableId);
                if (!oTable) {
                    console.error("Table not found:", sTableId);
                    sap.m.MessageBox.error(`Table '${sTableId}' not found.`);
                    return;
                }

                console.log(`=== [ADD] Starting add new row for ${sTableId} ===`);

                // Get table binding with retry logic (prefer MDC row binding)
                let oBinding = (oTable.getRowBinding && oTable.getRowBinding())
                    || oTable.getBinding("items")
                    || oTable.getBinding("rows");
                console.log("Primary binding check:", oBinding);
                
                // Optional debug (avoid calling non-existent APIs)
                try { console.log("Table model:", oTable.getModel()); } catch (e) {}
                try { console.log("Table binding info (items):", oTable.getBindingInfo && oTable.getBindingInfo("items")); } catch (e) {}
                
                if (!oBinding) {
                    console.log("Primary binding not found, retrying shortly...");
                    setTimeout(() => {
                        const oRetryBinding = (oTable.getRowBinding && oTable.getRowBinding())
                            || oTable.getBinding("items")
                            || oTable.getBinding("rows")
                            || oTable.getBinding("data");
                        if (oRetryBinding) {
                            console.log("Binding found on retry:", oRetryBinding);
                            this._executeAddWithRetry(oTable, oRetryBinding, sTableId);
                        } else {
                            sap.m.MessageBox.error("No data binding available. Please ensure the table is fully loaded and try again.");
                        }
                    }, 400);
                    return;
                }
                
                if (!oBinding) {
                    console.error("No binding found with any method");
                    
                    // Try to get model directly and create binding manually
                    const oModel = oTable.getModel();
                    if (oModel) {
                        console.log("Model found, trying to create binding manually...");
                        const sPath = "/" + sTableId; // Try direct path
                        console.log("Trying direct path:", sPath);
                        
                        try {
                            // Try to create a new context directly
                            const oNewContext = oModel.createEntry(sPath, {
                                properties: this._createEmptyRowData(sTableId)
                            });
                            
                            if (oNewContext) {
                                console.log("Direct context creation successful:", oNewContext.getPath());
                                
                                // 🚨 Add client-side properties AFTER context creation
                                const oData = oNewContext.getObject();
                                if (oData) {
                                    oData._isNew = true;
                                    oData.isEditable = true;
                                    oData._hasChanged = false;
                                    console.log("Added client-side properties to direct context");
                                }
                                
                                this._executeAddWithRetry(oTable, null, sTableId, oNewContext);
                                return;
                            }
                        } catch (directError) {
                            console.log("Direct context creation failed:", directError);
                        }
                    }
                    
                    // Try one more time with a longer delay
                    setTimeout(() => {
                        console.log("Retrying binding detection...");
                        oBinding = oTable.getBinding("items") || oTable.getBinding("rows") || oTable.getBinding("data");
                        if (oBinding) {
                            console.log("Binding found on retry:", oBinding.getPath());
                            this._executeAddWithRetry(oTable, oBinding, sTableId);
                        } else {
                            sap.m.MessageBox.error("No data binding available. Please ensure the table is fully loaded and try again.");
                        }
                    }, 1000); // Increased delay to 1 second
                    return;
                }

                // Create new empty row data and create via V4 ListBinding.create
                const oNewRowData = this._createEmptyRowData(sTableId);
                console.log("New row data:", oNewRowData);
                const oNewContext = oBinding.create(oNewRowData);

                if (!oNewContext) {
                    console.error("Failed to create new context");
                    sap.m.MessageBox.error("Failed to create new row.");
                    return;
                }

                console.log("New context created:", oNewContext.getPath());

                // 🚨 Add client-side properties AFTER context creation (not in the data sent to server)
                const oData = oNewContext.getObject();
                if (oData) {
                    oData._isNew = true;
                    oData.isEditable = true;
                    oData._hasChanged = false;
                    console.log("Added client-side properties to new context");
                }

                // Set the new row in edit mode
                const oEditModel = this.getView().getModel("edit");
                if (!oEditModel) {
                    // Create edit model if it doesn't exist
                    const oEditModelData = {
                        editingPath: "",
                        mode: null
                    };
                    this.getView().setModel(new sap.ui.model.json.JSONModel(oEditModelData), "edit");
                }

                const oEditModelFinal = this.getView().getModel("edit");
                // Accumulate editing paths to support multi-row add
                const sExistingPaths = oEditModelFinal.getProperty("/editingPath") || "";
                const sNewPath = oNewContext.getPath();
                if (sExistingPaths && sExistingPaths.length > 0) {
                    const aPaths = sExistingPaths.split(",").filter(Boolean);
                    if (!aPaths.includes(sNewPath)) {
                        aPaths.push(sNewPath);
                    }
                    oEditModelFinal.setProperty("/editingPath", aPaths.join(","));
                    oEditModelFinal.setProperty("/mode", "add-multi");
                } else {
                    oEditModelFinal.setProperty("/editingPath", sNewPath);
                    oEditModelFinal.setProperty("/mode", "add");
                }

                // Enable Save and Cancel buttons, disable others
                const buttonMap = {
                    "Customers": { edit: "btnEdit_cus", delete: "btnDelete_cus", save: "saveButton", cancel: "cancelButton", add: "btnAdd" },
                    "Employees": { edit: "Edit_emp", delete: "Delete_emp", save: "saveButton_emp", cancel: "cancelButton_emp", add: "btnAdd_emp" },
                    "Opportunities": { edit: "btnEdit_oppr", delete: "btnDelete_oppr", save: "saveButton_oppr", cancel: "cancelButton_oppr", add: "btnAdd_oppr" },
                    "Projects": { edit: "btnEdit_proj", delete: "btnDelete_proj", save: "saveButton_proj", cancel: "cancelButton_proj", add: "btnAdd_proj" },
                    "SAPIdStatuses": { edit: "btnEdit_sap", delete: "btnDelete_sap", save: "saveButton_sap", cancel: "cancelButton_sap", add: "btnAdd_sap" }
                };

                const config = buttonMap[sTableId];
                this.byId(config.save)?.setEnabled(true);
                this.byId(config.cancel)?.setEnabled(true);
                this.byId(config.edit)?.setEnabled(false);
                this.byId(config.delete)?.setEnabled(false);
                // Keep Add enabled to allow multi-row creation
                this.byId(config.add)?.setEnabled(true);

                // Clear any existing selection
                oTable.clearSelection();

                // Refresh table to show new row in edit mode
                oTable.getBinding("items")?.refresh();

                // Force refresh to ensure edit mode is applied
                setTimeout(() => {
                    oTable.getBinding("items")?.refresh();
                    console.log(`[ADD] New row added and in edit mode for ${sTableId}`);
                }, 100);

                sap.m.MessageToast.show("New row added. You can now fill in the data.");

            } catch (error) {
                console.error("Add row error:", error);
                sap.m.MessageBox.error("Failed to add new row: " + error.message);
            }
        },

        // 🚀 EXECUTE ADD WITH RETRY (for delayed binding detection)
        _executeAddWithRetry: function (oTable, oBinding, sTableId, oExistingContext) {
            try {
                let oNewContext = oExistingContext;
                
                if (!oNewContext && oBinding) {
                    // Get the model and path
                    const oModel = oBinding.getModel();
                    const sPath = oBinding.getPath();
                    console.log("Retry - Binding path:", sPath);

                    // Create new empty row data
                    const oNewRowData = this._createEmptyRowData(sTableId);
                    console.log("Retry - New row data:", oNewRowData);

                    // Create new entry using OData V4 createEntry method
                    oNewContext = oModel.createEntry(sPath, {
                        properties: oNewRowData
                    });

                    if (!oNewContext) {
                        console.error("Failed to create new context");
                        sap.m.MessageBox.error("Failed to create new row.");
                        return;
                    }

                    console.log("Retry - New context created:", oNewContext.getPath());
                    
                    // 🚨 Add client-side properties AFTER context creation
                    const oData = oNewContext.getObject();
                    if (oData) {
                        oData._isNew = true;
                        oData.isEditable = true;
                        oData._hasChanged = false;
                        console.log("Added client-side properties to retry context");
                    }
                } else if (oNewContext) {
                    console.log("Using existing context:", oNewContext.getPath());
                } else {
                    console.error("No context available");
                    sap.m.MessageBox.error("Failed to create new row.");
                    return;
                }

                // Set the new row in edit mode
                const oEditModel = this.getView().getModel("edit");
                if (!oEditModel) {
                    // Create edit model if it doesn't exist
                    const oEditModelData = {
                        editingPath: "",
                        mode: null
                    };
                    this.getView().setModel(new sap.ui.model.json.JSONModel(oEditModelData), "edit");
                }

                const oEditModelFinal = this.getView().getModel("edit");
                oEditModelFinal.setProperty("/editingPath", oNewContext.getPath());
                oEditModelFinal.setProperty("/mode", "add");

                // Enable Save and Cancel buttons, disable others
                const buttonMap = {
                    "Customers": { edit: "btnEdit_cus", delete: "btnDelete_cus", save: "saveButton", cancel: "cancelButton", add: "btnAdd" },
                    "Employees": { edit: "Edit_emp", delete: "Delete_emp", save: "saveButton_emp", cancel: "cancelButton_emp", add: "btnAdd_emp" },
                    "Opportunities": { edit: "btnEdit_oppr", delete: "btnDelete_oppr", save: "saveButton_oppr", cancel: "cancelButton_oppr", add: "btnAdd_oppr" },
                    "Projects": { edit: "btnEdit_proj", delete: "btnDelete_proj", save: "saveButton_proj", cancel: "cancelButton_proj", add: "btnAdd_proj" },
                    "SAPIdStatuses": { edit: "btnEdit_sap", delete: "btnDelete_sap", save: "saveButton_sap", cancel: "cancelButton_sap", add: "btnAdd_sap" }
                };

                const config = buttonMap[sTableId];
                this.byId(config.save)?.setEnabled(true);
                this.byId(config.cancel)?.setEnabled(true);
                this.byId(config.edit)?.setEnabled(false);
                this.byId(config.delete)?.setEnabled(false);
                // Keep Add enabled to allow multi-row creation in retry path as well
                this.byId(config.add)?.setEnabled(true);

                // Clear any existing selection
                oTable.clearSelection();

                // Refresh table to show new row in edit mode
                oTable.getBinding("items")?.refresh();

                // Force refresh to ensure edit mode is applied
                setTimeout(() => {
                    oTable.getBinding("items")?.refresh();
                    console.log(`[ADD-RETRY] New row added and in edit mode for ${sTableId}`);
                }, 100);

                sap.m.MessageToast.show("New row added. You can now fill in the data.");

            } catch (error) {
                console.error("Retry add error:", error);
                sap.m.MessageBox.error("Failed to add new row: " + error.message);
            }
        },

        // 🚀 HELPER: Create empty row data based on table type
        _createEmptyRowData: function (sTableId) {
            const oEmptyData = {};

            // Create specific default values based on table type
            if (sTableId === "Customers") {
                oEmptyData.sapcustId = ""; // Will be auto-generated
                oEmptyData.sfdccustomerId = ""; // Will be auto-generated
                oEmptyData.name = ""; // User will fill this
                oEmptyData.city = ""; // User will fill this
                oEmptyData.country = ""; // User will fill this
                oEmptyData.status = "A"; // Default to Active
                oEmptyData.verticalId = 1; // Default vertical
            } else if (sTableId === "Employees") {
                oEmptyData.ohrId = ""; // Will be auto-generated
                oEmptyData.mailid = ""; // User will fill this
                oEmptyData.firstName = ""; // User will fill this
                oEmptyData.lastName = ""; // User will fill this
                oEmptyData.gender = ""; // User will fill this
                oEmptyData.dob = new Date().toISOString().split('T')[0]; // Today's date
                oEmptyData.employeeType = "F"; // Default to FullTime
                oEmptyData.doj = new Date().toISOString().split('T')[0]; // Today's date
                oEmptyData.band = ""; // User will fill this
                oEmptyData.role = ""; // User will fill this
                oEmptyData.experience = 0; // Default to 0
                oEmptyData.poc = ""; // User will fill this
                oEmptyData.sapidstatusId = 1; // Default status
            } else if (sTableId === "Opportunities") {
                oEmptyData.sapOpportunityId = ""; // Will be auto-generated
                oEmptyData.sfdcOpportunityId = ""; // User will fill this
                oEmptyData.probability = "ProposalStage"; // Default to 0%
                oEmptyData.salesSPOC = ""; // User will fill this
                oEmptyData.deliverySPOC = ""; // User will fill this
                oEmptyData.expectedStart = new Date().toISOString().split('T')[0]; // Today
                oEmptyData.expectedEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days from now
                oEmptyData.customerId = 1; // Default customer
            } else if (sTableId === "Projects") {
                oEmptyData.sapPId = ""; // Will be auto-generated
                oEmptyData.sfdcPId = ""; // User will fill this
                oEmptyData.name = ""; // User will fill this
                oEmptyData.startDate = new Date().toISOString().split('T')[0]; // Today
                oEmptyData.endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 90 days from now
                oEmptyData.pmo = ""; // User will fill this
                oEmptyData.oppId = 1; // Default opportunity
            } else if (sTableId === "SAPIdStatuses") {
                oEmptyData.id = ""; // Will be auto-generated
                oEmptyData.status = "A"; // Default to Allocated
            }

            // 🚨 DON'T add client-side properties to the data that goes to server
            // These properties are added separately after context creation
            return oEmptyData;
        },

        // Dialog-based add/edit to avoid inline editing
        // _openPersonDialog: function ({ mode, context }) {
        //     const oView = this.getView();
        //     const oTable = this.byId("Customers");

        //     // Determine fields from current columns to keep alignment with p13n
        //     const aFields = (oTable.getColumns ? oTable.getColumns() : [])
        //         .map(function (c) { return c.getPropertyKey && c.getPropertyKey(); })
        //         .filter(Boolean);
        //     if (!aFields.length) {
        //         // fallback
        //         Array.prototype.push.apply(aFields, ["ohrId", "firstName", "lastName", "email", "age"]);
        //     }

        //     const oPrefill = (mode === "edit" && context && context.getObject) ? context.getObject() : {};
        //     const oLocal = new JSONModel({
        //         title: mode === "edit" ? "Edit" : "Add",
        //         values: aFields.reduce(function (acc, k) { acc[k] = (oPrefill && oPrefill[k]) || ""; return acc; }, {})
        //     });

        //     sap.ui.require(["sap/m/Dialog", "sap/m/Button", "sap/m/Label", "sap/m/Input", "sap/m/VBox"],
        //         function (Dialog, Button, Label, Input, VBox) {
        //             const aItems = [];
        //             aFields.forEach(function (sKey) {
        //                 aItems.push(new Label({ text: sKey }));
        //                 aItems.push(new Input({ value: `{dlg>/values/${sKey}}` }));
        //             });

        //             const oVBox = new VBox({ items: aItems });

        //             const oDlg = new Dialog({
        //                 title: "{dlg>/title}",
        //                 contentWidth: "420px",
        //                 content: [oVBox],
        //                 beginButton: new Button({
        //                     text: mode === "edit" ? "Save" : "Create",
        //                     press: () => {
        //                         const v = oDlg.getModel("dlg").getProperty("/values");
        //                         if (mode === "add") {
        //                             const oBinding = this._getPersonsBinding();
        //                             if (!oBinding || !oBinding.create) {
        //                                 MessageToast.show("Create not available");
        //                                 return;
        //                             }
        //                             oBinding.create(v, false, "$auto");
        //                             this._updatePendingState();
        //                             MessageToast.show("Row created");
        //                         } else if (mode === "edit" && context) {
        //                             aFields.forEach(function (k) {
        //                                 if (context.setProperty) {
        //                                     context.setProperty(k, v[k]);
        //                                 }
        //                             });
        //                             this._updatePendingState();
        //                             MessageToast.show("Row updated (use Save to persist)");
        //                         }
        //                         oDlg.close();
        //                     }
        //                 }),
        //                 endButton: new Button({ text: "Cancel", press: function () { oDlg.close(); } })
        //             });
        //             oDlg.addStyleClass("sapUiContentPadding");
        //             oDlg.setModel(oLocal, "dlg");
        //             oView.addDependent(oDlg);
        //             oDlg.open();
        //         }.bind(this)
        //     );
        // },


    });
});