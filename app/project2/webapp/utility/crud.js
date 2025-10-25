/**
 * CRUD Operations Utility
 * Extracted from CustomUtility.js and controller.txt
 * Contains all Create, Read, Update, Delete operations
 */

sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return {

        // ===========================================
        // CREATE OPERATIONS
        // ===========================================

        /**
         * Creates a new row in the table
         * @param {sap.ui.mdc.Table} oTable - The table instance
         * @param {Object} oData - Data for the new row
         */
        createRow: function (oTable, oData) {
            const oBinding = oTable.getBinding("items");
            if (oBinding && oBinding.create) {
                return oBinding.create(oData, false, "$auto");
            }
            throw new Error("Create operation not available");
        },

        /**
         * Adds empty row on top of table
         * @param {sap.ui.mdc.Table} oTable - The table instance
         */
        addEmptyRowOnTop: function (oTable) {
            oTable.setSortConditions(null);
            const oItemsModel = oTable.getModel("items");
            const aRows = oItemsModel.getProperty("/aData") || [];

            // Create a new empty row
            const oNewRow = {
                ProjectID: "",
                Task: "",
                Hours: "",
                Status: "New",
            };

            // Insert new row at top
            aRows.unshift(oNewRow);

            const aUpdatedEditableIndexes = [];
            aRows.forEach(element => {
                if (element.Status === "New") {
                    aUpdatedEditableIndexes.push(element.__rowIndex);
                }
            });

            // Update model properties
            oItemsModel.setProperty("/aData", aRows);
            oItemsModel.setProperty("/aEditableRowIndexes", aUpdatedEditableIndexes);
        },

        /**
         * Creates multiple records via batch upload
         * @param {Array} aRecords - Array of records to create
         * @param {string} sEntitySet - Target entity set
         * @param {string} sServiceUrl - Service URL
         * @param {string} sEmail - User email for on-behalf-of
         */
        createMultipleRecords: async function (aRecords, sEntitySet, sServiceUrl, sEmail) {
            let iSuccessCount = 0, iFailureCount = 0;
            const aMessages = [];

            // Get CSRF token
            let sCsrfToken = null;
            try {
                const oTokenRes = await fetch(sServiceUrl, {
                    method: "GET",
                    headers: { "X-CSRF-Token": "Fetch" },
                    credentials: "same-origin"
                });
                sCsrfToken = oTokenRes.headers.get("x-csrf-token");
            } catch (oError) {
                console.warn("CSRF token fetch failed:", oError);
            }

            for (const [iIndex, oRecord] of aRecords.entries()) {
                try {
                    const oRes = await fetch(`${sServiceUrl}${sEntitySet}`, {
                        method: "POST",
                        credentials: "same-origin",
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json;odata.metadata=minimal",
                            ...(sCsrfToken && { "X-CSRF-Token": sCsrfToken }),
                            ...(sEmail ? { "X-onbehalfof-User": sEmail } : {})
                        },
                        body: JSON.stringify(oRecord)
                    });

                    const sText = await oRes.text();
                    let sBackendMsg = "";
                    try {
                        const oParsed = JSON.parse(sText);
                        sBackendMsg = oParsed?.Message || oParsed?.message || oParsed?.error?.message || oParsed?.d?.error?.message || "";
                    } catch {
                        sBackendMsg = sText;
                    }

                    if (oRes.status === 201) {
                        iSuccessCount++;
                        aMessages.push(new sap.ui.core.message.Message({
                            message: `✅ Record ${iIndex + 1} uploaded successfully`,
                            type: sap.ui.core.MessageType.Success,
                            description: sBackendMsg || "HTTP 201 Created",
                            additionalText: `Record Index: ${iIndex + 1}`,
                            target: "/Dummy",
                            processor: this.getView().getModel()
                        }));
                    } else {
                        iFailureCount++;
                        aMessages.push(new sap.ui.core.message.Message({
                            message: `❌ Record ${iIndex + 1} failed: ${sBackendMsg || oRes.statusText}`,
                            type: sap.ui.core.MessageType.Error,
                            description: `HTTP ${oRes.status} ${oRes.statusText}`,
                            additionalText: `Record Index: ${iIndex + 1}`,
                            target: "/Dummy",
                            processor: this.getView().getModel()
                        }));
                    }
                } catch (oError) {
                    iFailureCount++;
                    aMessages.push(new sap.ui.core.message.Message({
                        message: `❌ Record ${iIndex + 1} failed: Network/Unexpected error`,
                        type: sap.ui.core.MessageType.Error,
                        description: oError.message || JSON.stringify(oError),
                        additionalText: `Record Index: ${iIndex + 1}`,
                        target: "/Dummy",
                        processor: this.getView().getModel()
                    }));
                }
            }

            return { iSuccessCount, iFailureCount, aMessages };
        },

        // ===========================================
        // READ OPERATIONS
        // ===========================================

        /**
         * Reads data from table binding
         * @param {sap.ui.mdc.Table} oTable - The table instance
         * @returns {Array} Array of data objects
         */
        readTableData: function (oTable) {
            const oBinding = oTable.getBinding("items");
            if (oBinding) {
                return oBinding.getContexts().map(oContext => oContext.getObject());
            }
            return [];
        },

        /**
         * Gets selected contexts from table
         * @param {sap.ui.mdc.Table} oTable - The table instance
         * @returns {Array} Array of selected contexts
         */
        getSelectedContexts: function (oTable) {
            return oTable.getSelectedContexts ? oTable.getSelectedContexts() : [];
        },

        /**
         * Fetches entity data for a given entity set and date range
         * @param {string} sEntitySet - The OData entity set name
         * @param {string} sStartDate - Start date in YYYY-MM-DD format
         * @param {string} sEndDate - End date in YYYY-MM-DD format
         * @param {string} sServiceUrl - Service URL
         * @param {string} sEmail - User email for on-behalf-of
         * @returns {Promise<Object[]>} Resolves with the array of entries
         */
        fetchEntityData: function (sEntitySet, sStartDate, sEndDate, sServiceUrl, sEmail) {
            const sStartDateISO = sStartDate + "T00:00:00Z";
            const sEndDateISO = sEndDate + "T23:59:59Z";

            const aParams = [
                `$filter=TimeSheetDate ge ${sStartDateISO} and TimeSheetDate le ${sEndDateISO}`,
                `$select=TimeSheetDate,TimeSheetUnit`
            ];

            const sURL = `${sServiceUrl}${sEntitySet}?${aParams.join("&")}`;

            return fetch(sURL, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    ...(sEmail ? { "X-onbehalfof-User": sEmail } : {})
                }
            })
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    return res.json();
                })
                .then(oData => oData.value || oData)
                .catch(error => {
                    console.error(`❌ Error loading ${sEntitySet}:`, error);
                    return [];
                });
        },

        // ===========================================
        // UPDATE OPERATIONS
        // ===========================================

        /**
         * Updates a single record
         * @param {Object} oData - Data object to update
         * @param {string} sEntitySet - Target entity set
         * @param {string} sServiceUrl - Service URL
         * @param {string} sEmail - User email for on-behalf-of
         */
        updateRecord: async function (oData, sEntitySet, sServiceUrl, sEmail) {
            const sKey = encodeURIComponent(oData.ID);
            const sURL = `${sServiceUrl}${sEntitySet}(${sKey})`;

            const oResponse = await fetch(sURL, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    ...(sEmail ? { "X-onbehalfof-User": sEmail } : {})
                },
                body: JSON.stringify(oData)
            });

            if (!oResponse.ok) {
                const sErrorText = await oResponse.text();
                throw {
                    responseText: sErrorText,
                    status: oResponse.status,
                    statusText: oResponse.statusText
                };
            }

            return oResponse;
        },

        /**
         * Updates multiple records
         * @param {Array} aRecords - Array of records to update
         * @param {string} sEntitySet - Target entity set
         * @param {string} sServiceUrl - Service URL
         * @param {string} sEmail - User email for on-behalf-of
         */
        updateMultipleRecords: async function (aRecords, sEntitySet, sServiceUrl, sEmail) {
            const aUpdatePromises = [];

            for (let iIndex = 0; iIndex < aRecords.length; iIndex++) {
                const oData = aRecords[iIndex];
                
                const oPromise = this.updateRecord(oData, sEntitySet, sServiceUrl, sEmail)
                    .then(() => {
                        console.log(`✅ Edited row ${iIndex + 1} saved successfully. ID=${oData.ID}`);
                    })
                    .catch(oError => {
                        let sErrorMessage = "Unknown error";
                        let sErrorTarget = "";
                        let sErrorDetails = "";

                        if (oError?.responseText) {
                            sErrorDetails = oError.responseText;
                        }

                        try {
                            const oErrObj = JSON.parse(oError.responseText);

                            if (oErrObj?.error) {
                                if (oErrObj.error.message?.value) {
                                    sErrorMessage = oErrObj.error.message.value;
                                } else if (oErrObj.error.message) {
                                    sErrorMessage = oErrObj.error.message;
                                }

                                if (oErrObj.error.target) {
                                    sErrorTarget = oErrObj.error.target;
                                }
                            }
                        } catch (oE) {
                            sErrorMessage = oError.responseText || `${oError.status} ${oError.statusText}`;
                        }

                        const sFinalMessage = sErrorTarget
                            ? `❌ Failed to edit row ${iIndex + 1} (Field: ${sErrorTarget}) - ${sErrorMessage}`
                            : `❌ Failed to edit row ${iIndex + 1} - ${sErrorMessage}`;

                        throw new Error(sFinalMessage);
                    });

                aUpdatePromises.push(oPromise);
            }

            return Promise.allSettled(aUpdatePromises);
        },

        /**
         * Puts selected row into edit mode
         * @param {sap.ui.mdc.Table} oTable - The table instance
         */
        enterEditMode: function (oTable) {
            const aSelectedContexts = oTable.getSelectedContexts();
            const oItemsModel = oTable.getModel("items");
            const aEditableIndexes = [];

            // Helper function to create deep copy preserving Date objects
            const fnCreateDeepCopyWithDates = (oObj) => {
                if (oObj === null || typeof oObj !== "object") return oObj;
                if (oObj instanceof Date) return new Date(oObj.getTime());
                if (Array.isArray(oObj)) return oObj.map(fnCreateDeepCopyWithDates);

                const oCopy = {};
                Object.keys(oObj).forEach(sKey => {
                    oCopy[sKey] = fnCreateDeepCopyWithDates(oObj[sKey]);
                });
                return oCopy;
            };

            aSelectedContexts.forEach((oContext) => {
                const iIndex = parseInt(oContext.getPath().split("/").pop());
                aEditableIndexes.push(iIndex);
                const oData = oContext.getObject();

                // Create snapshot preserving Date objects
                oData._originalData = fnCreateDeepCopyWithDates(oData);
                oData.isEditable = true;
            });

            oItemsModel.setProperty("/aEditableRowIndexes", aEditableIndexes);
        },

        // ===========================================
        // DELETE OPERATIONS
        // ===========================================

        /**
         * Deletes a single record
         * @param {Object} oContext - Context to delete
         * @param {string} sEntitySet - Target entity set
         * @param {string} sServiceUrl - Service URL
         * @param {string} sEmail - User email for on-behalf-of
         */
        deleteRecord: async function (oContext, sEntitySet, sServiceUrl, sEmail) {
            const oRow = oContext.getObject();
            const sKey = oRow.ID.match(/^[0-9a-fA-F-]{36}$/)
                ? oRow.ID           // GUID → no quotes
                : `'${oRow.ID}'`;   // String → wrap in quotes

            const sURL = `${sServiceUrl}${sEntitySet}(${sKey})`;

            const oResponse = await fetch(sURL, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    ...(sEmail ? { "X-onbehalfof-User": sEmail } : {})
                }
            });

            if (!oResponse.ok && oResponse.status !== 204) {
                throw new Error(`Delete failed: ${oResponse.statusText}`);
            }

            return oResponse;
        },

        /**
         * Deletes multiple records
         * @param {Array} aContexts - Array of contexts to delete
         * @param {string} sEntitySet - Target entity set
         * @param {string} sServiceUrl - Service URL
         * @param {string} sEmail - User email for on-behalf-of
         */
        deleteMultipleRecords: async function (aContexts, sEntitySet, sServiceUrl, sEmail) {
            let bErrorOccurred = false;

            for (const oContext of aContexts) {
                try {
                    await this.deleteRecord(oContext, sEntitySet, sServiceUrl, sEmail);
                } catch (oError) {
                    console.error("Delete failed:", oError);
                    bErrorOccurred = true;
                }
            }

            return !bErrorOccurred;
        },

        /**
         * Deletes selected entries from table
         * @param {sap.ui.mdc.Table} oTable - The table instance
         * @param {string} sEntitySet - Target entity set
         * @param {string} sServiceUrl - Service URL
         * @param {string} sEmail - User email for on-behalf-of
         */
        deleteSelectedEntries: async function (oTable, sEntitySet, sServiceUrl, sEmail) {
            const aSelectedContexts = oTable.getSelectedContexts?.() || [];

            if (aSelectedContexts.length === 0) {
                return MessageBox.warning("Please select one or more entries to delete.");
            }

            return new Promise((resolve, reject) => {
                MessageBox.confirm("Are you sure you want to delete the selected entries?", {
                    onClose: async (sAction) => {
                        if (sAction !== MessageBox.Action.OK) {
                            return resolve(false);
                        }

                        try {
                            const bSuccess = await this.deleteMultipleRecords(aSelectedContexts, sEntitySet, sServiceUrl, sEmail);
                            
                            if (bSuccess) {
                                MessageToast.show("Entries successfully deleted");
                            } else {
                                MessageBox.error("Some rows could not be deleted. Check console for details.");
                            }
                            
                            oTable.clearSelection();
                            resolve(bSuccess);
                        } catch (error) {
                            console.error("Delete operation failed:", error);
                            reject(error);
                        }
                    }
                });
            });
        },

        // ===========================================
        // CANCEL OPERATIONS
        // ===========================================

        /**
         * Cancels editing and restores original data
         * @param {sap.ui.mdc.Table} oTable - The table instance
         * @param {string} sPath - Path of the row being edited
         */
        cancelEdit: function (oTable, sPath) {
            const oItemsModel = oTable.getModel("items");
            const oContext = oTable.getBinding("items").getContext(sPath);
            
            if (oContext) {
                const oData = oContext.getObject();
                
                if (oData._originalData) {
                    const oOriginalData = oData._originalData;
                    
                    // Restore all original properties including dates
                    Object.keys(oOriginalData).forEach(sKey => {
                        if (sKey !== '_originalData' && sKey !== 'isEditable' && sKey !== '_hasChanged') {
                            let vValue = oOriginalData[sKey];
                            if (vValue instanceof Date) {
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

            // Reset edit state
            const aEditableIndexes = oItemsModel.getProperty("/aEditableRowIndexes") || [];
            const iIndex = parseInt(sPath.split("/").pop());
            const aNewEditableIndexes = aEditableIndexes.filter(iIndexTemp => iIndexTemp !== iIndex);
            oItemsModel.setProperty("/aEditableRowIndexes", aNewEditableIndexes);
        },

        /**
         * Cancels new row creation
         * @param {sap.ui.mdc.Table} oTable - The table instance
         * @param {string} sPath - Path of the row to cancel
         */
        cancelNewRow: function (oTable, sPath) {
            const oItemsModel = oTable.getModel("items");
            const aRows = oItemsModel.getProperty("/aData") || [];
            const iIndex = parseInt(sPath.split("/").pop());

            // Remove the row
            aRows.splice(iIndex, 1);
            oItemsModel.setProperty("/aData", aRows);
        },

        // ===========================================
        // SAVE OPERATIONS
        // ===========================================

        /**
         * Saves changes to the backend
         * @param {Array} aRecords - Records to save
         * @param {string} sSaveMode - "add" or "edit"
         * @param {string} sEntitySet - Target entity set
         * @param {string} sServiceUrl - Service URL
         * @param {string} sEmail - User email for on-behalf-of
         */
        saveChanges: async function (aRecords, sSaveMode, sEntitySet, sServiceUrl, sEmail) {
            const aSavePromises = [];

            if (sSaveMode === "add") {
                // Create new records
                for (let iIndex = 0; iIndex < aRecords.length; iIndex++) {
                    const oRecord = aRecords[iIndex];
                    const sURL = `${sServiceUrl}${sEntitySet}`;

                    const oPromise = fetch(sURL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json; charset=utf-8",
                            ...(sEmail ? { "X-onbehalfof-User": sEmail } : {})
                        },
                        body: JSON.stringify(oRecord)
                    }).then(async oResponse => {
                        if (!oResponse.ok) {
                            const sText = await oResponse.text();
                            throw new Error(`HTTP ${oResponse.status} ${oResponse.statusText}: ${sText}`);
                        }
                        console.log(`✅ New row ${iIndex + 1} created successfully.`);
                    });

                    aSavePromises.push(oPromise);
                }
            } else if (sSaveMode === "edit") {
                // Update existing records
                const aResults = await this.updateMultipleRecords(aRecords, sEntitySet, sServiceUrl, sEmail);
                return aResults;
            }

            return Promise.allSettled(aSavePromises);
        },

        // ===========================================
        // UTILITY OPERATIONS
        // ===========================================

        /**
         * Validates form data before saving
         * @param {Array} aRecords - Records to validate
         * @param {Array} aEditableColumns - Column configuration
         * @returns {Array} Array of invalid records
         */
        validateData: function (aRecords, aEditableColumns) {
            const aInvalidRecords = [];

            aRecords.forEach((oRecord, iIndex) => {
                const aMissingFields = aEditableColumns.filter(oCol => 
                    oCol.property !== "TimeSheetNote" && 
                    !oRecord[oCol.property] && 
                    oRecord[oCol.property] !== 0
                );

                if (aMissingFields.length > 0) {
                    aInvalidRecords.push({
                        index: iIndex,
                        record: oRecord,
                        missingFields: aMissingFields.map(oCol => oCol.property)
                    });
                }
            });

            return aInvalidRecords;
        },

        /**
         * Clears table selection and resets button states
         * @param {sap.ui.mdc.Table} oTable - The table instance
         */
        resetTableState: function (oTable) {
            oTable.clearSelection();
            
            // Reset button states
            const aButtonIds = ["saveButton", "cancelButton", "btnEdit_cus", "btnDelete_cus", "btnAdd"];
            aButtonIds.forEach(sButtonId => {
                const oButton = this.byId(sButtonId);
                if (oButton) {
                    if (sButtonId === "saveButton" || sButtonId === "cancelButton") {
                        oButton.setEnabled(false);
                    } else {
                        oButton.setEnabled(true);
                    }
                }
            });
        },

        /**
         * Updates button states based on selection
         * @param {sap.ui.mdc.Table} oTable - The table instance
         * @param {boolean} bHasEditableRows - Whether there are editable rows
         */
        updateButtonStates: function (oTable, bHasEditableRows) {
            const aSelectedContexts = oTable.getSelectedContexts();
            const bHasSelection = aSelectedContexts.length > 0;

            // Update button states
            this.byId("btnEdit_cus")?.setEnabled(bHasSelection && !bHasEditableRows);
            this.byId("btnDelete_cus")?.setEnabled(bHasSelection && !bHasEditableRows);
            this.byId("btnAdd")?.setEnabled(!bHasEditableRows);
        }
    };
});
