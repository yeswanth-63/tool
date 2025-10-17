sap.ui.define([
    "sap/ui/mdc/odata/v4/TableDelegate",
    "sap/ui/model/Sorter",
    "sap/ui/mdc/FilterField",
    "sap/ui/mdc/Field",
    "sap/ui/mdc/library",
    "sap/m/HBox",
    "sap/m/Button",
    "sap/m/library"
], function (ODataTableDelegate, Sorter, FilterField, Field, mdcLibrary, HBox, Button, mLibrary) {
    "use strict";

    const GenericTableDelegate = Object.assign({}, ODataTableDelegate);

    // Ensure Table advertises support for all desired p13n panels
    GenericTableDelegate.getSupportedP13nModes = function() {
        return ["Column", "Sort", "Filter", "Group"];
    };

    GenericTableDelegate.fetchProperties = function (oTable) {
        console.log("=== [GenericDelegate] fetchProperties called ===");

        const oModel = oTable.getModel();
        if (!oModel) {
            console.error("[GenericDelegate] No model found on table");
            return Promise.resolve([]);
        }

        const oMetaModel = oModel.getMetaModel();
        console.log("[GenericDelegate] MetaModel:", oMetaModel);

        // Get collection path from payload
        const sCollectionPath = oTable.getPayload()?.collectionPath?.replace(/^\//, "") || "Customers";
        console.log("[GenericDelegate] Collection Path:", sCollectionPath);

        // Wait for metadata to be loaded
        return oMetaModel.requestObject(`/${sCollectionPath}/$Type`)
            .then(function (sEntityTypePath) {
                console.log("[GenericDelegate] Entity Type Path:", sEntityTypePath);

                // Request the entity type definition
                return oMetaModel.requestObject(`/${sEntityTypePath}/`);
            })
            .then(function (oEntityType) {
                console.log("[GenericDelegate] Entity Type loaded:", oEntityType);

                const aProperties = [];

                // Iterate through entity type properties
                Object.keys(oEntityType).forEach(function (sPropertyName) {
                    // Skip metadata properties that start with $
                    if (sPropertyName.startsWith("$")) {
                        return;
                    }

                    const oProperty = oEntityType[sPropertyName];
                    console.log("[GenericDelegate] Processing property:", sPropertyName, oProperty);

                    // Check if it's a property (not a navigation property)
                    if (oProperty.$kind === "Property" || !oProperty.$kind) {
                        const sType = oProperty.$Type || "Edm.String";

                        // Include all necessary attributes for sorting/filtering
                        aProperties.push({
                            name: sPropertyName,
                            path: sPropertyName,
                            label: sPropertyName,
                            dataType: sType,
                            sortable: true,
                            filterable: true,
                            groupable: true,
                            maxConditions: -1,
                            caseSensitive: sType === "Edm.String" ? false : undefined
                        });
                    }
                });

                console.log("[GenericDelegate] Final properties array:", aProperties);
                return aProperties;
            })
            .catch(function (oError) {
                console.error("[GenericDelegate] Error fetching properties:", oError);
                console.log("[GenericDelegate] Using fallback properties for", sCollectionPath);
                
                // Fallback properties based on collection path
                // const mFallbackProperties = {
                //     "Customers": [
                //         { name: "customerId", path: "customerId", label: "Customer ID", dataType: "Edm.Int32", sortable: true, filterable: true, groupable: true, maxConditions: -1 },
                //         { name: "name", path: "name", label: "Name", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "status", path: "status", label: "Status", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "createdAt", path: "createdAt", label: "Created At", dataType: "Edm.DateTimeOffset", sortable: true, filterable: true, groupable: true, maxConditions: -1 }
                //     ],
                //     "Opportunities": [
                //         { name: "oppId", path: "oppId", label: "Opportunity ID", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "customerId", path: "customerId", label: "Customer ID", dataType: "Edm.Int32", sortable: true, filterable: true, groupable: true, maxConditions: -1 },
                //         { name: "oppNumber", path: "oppNumber", label: "Opportunity Number", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "name", path: "name", label: "Name", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "stage", path: "stage", label: "Stage", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "probability", path: "probability", label: "Probability", dataType: "Edm.Decimal", sortable: true, filterable: true, groupable: true, maxConditions: -1 },
                //         { name: "expectedStart", path: "expectedStart", label: "Expected Start", dataType: "Edm.Date", sortable: true, filterable: true, groupable: true, maxConditions: -1 },
                //         { name: "expectedEnd", path: "expectedEnd", label: "Expected End", dataType: "Edm.Date", sortable: true, filterable: true, groupable: true, maxConditions: -1 }
                //     ],
                //     "Projects": [
                //         { name: "projectId", path: "projectId", label: "Project ID", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "oppId", path: "oppId", label: "Opportunity ID", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "name", path: "name", label: "Name", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "status", path: "status", label: "Status", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "createdBy", path: "createdBy", label: "Created By", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "techStack", path: "techStack", label: "Tech Stack", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false }
                //     ],
                //     "SAPIdStatuses": [
                //         { name: "sapId", path: "sapId", label: "SAP ID", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "currentProjectId", path: "currentProjectId", label: "Current Project ID", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "lastSeen", path: "lastSeen", label: "Last Seen", dataType: "Edm.DateTimeOffset", sortable: true, filterable: true, groupable: true, maxConditions: -1 }
                //     ],
                //     "Employees": [
                //         { name: "ohrId", path: "ohrId", label: "OHR ID", dataType: "Edm.Int32", sortable: true, filterable: true, groupable: true, maxConditions: -1 },
                //         { name: "sapId", path: "sapId", label: "SAP ID", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "firstName", path: "firstName", label: "First Name", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "lastName", path: "lastName", label: "Last Name", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "email", path: "email", label: "Email", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "costCenter", path: "costCenter", label: "Cost Center", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "skillSet", path: "skillSet", label: "Skill Set", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "status", path: "status", label: "Status", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false },
                //         { name: "manager", path: "manager", label: "Manager", dataType: "Edm.String", sortable: true, filterable: true, groupable: true, maxConditions: -1, caseSensitive: false }
                //     ]
                // };

                return mFallbackProperties[sCollectionPath] || [];
            });
    };

    GenericTableDelegate.updateBindingInfo = function (oTable, oBindingInfo) {
        ODataTableDelegate.updateBindingInfo.apply(this, arguments);

        const sPath = oTable.getPayload()?.collectionPath || "Customers";
        oBindingInfo.path = "/" + sPath;

        // Essential OData V4 parameters
        oBindingInfo.parameters = Object.assign(oBindingInfo.parameters || {}, {
            $count: true
        });

        console.log("[GenericDelegate] updateBindingInfo - path:", sPath, "bindingInfo:", oBindingInfo);
        console.log("[GenericDelegate] Table payload:", oTable.getPayload());
    };

    GenericTableDelegate.addItem = function (oTable, sPropertyName, mPropertyBag) {
        console.log("[GenericDelegate] addItem called for property:", sPropertyName);

        return this.fetchProperties(oTable).then(function (aProperties) {
            const oProperty = aProperties.find(function (p) {
                return p.name === sPropertyName || p.path === sPropertyName;
            });

            if (!oProperty) {
                console.error("[GenericDelegate] Property not found:", sPropertyName);
                return Promise.reject("Property not found: " + sPropertyName);
            }

            // Format label
            const sLabel = sPropertyName
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, function(str) { return str.toUpperCase(); })
                .trim();

            // Load the Column module and create column
            return new Promise(function (resolve) {
                sap.ui.require(["sap/ui/mdc/table/Column"], function (Column) {
                    const oField = new Field({
                        value: "{" + sPropertyName + "}",
                        editMode: {
                            parts: [{ path: 'edit>/editingPath' }],
                            formatter: function (sPath) {
                                var rowPath = this.getBindingContext() && this.getBindingContext().getPath();
                                return sPath === rowPath ? "Editable" : "Display";
                            }
                        }
                    });

                    const oColumn = new Column({
                        id: oTable.getId() + "--col-" + sPropertyName,
                        dataProperty: sPropertyName,
                        propertyKey: sPropertyName,
                        header: sLabel,
                        template: oField
                    });

                    console.log("[GenericDelegate] Column created via addItem:", sPropertyName);
                    resolve(oColumn);
                });
            });
        });
    };

    GenericTableDelegate.removeItem = function (oTable, oColumn, mPropertyBag) {
        console.log("[GenericDelegate] removeItem called for column:", oColumn);

        if (oColumn) {
            oColumn.destroy();
        }

        return Promise.resolve(true);
    };

    // Provide FilterField creation for Adaptation Filter panel in table p13n
    GenericTableDelegate.getFilterDelegate = function() {
        return {
            addItem: function(vArg1, vArg2, vArg3) {
                // Normalize signature: MDC may call (oTable, vProperty, mBag) or (vProperty, oTable, mBag)
                var oTable = (vArg1 && typeof vArg1.isA === "function" && vArg1.isA("sap.ui.mdc.Table")) ? vArg1 : vArg2;
                var vProperty = (oTable === vArg1) ? vArg2 : vArg1;
                var mPropertyBag = vArg3;

                // Resolve property name from string, property object, or mPropertyBag
                const sName =
                    (typeof vProperty === "string" && vProperty) ||
                    (vProperty && (vProperty.name || vProperty.path || vProperty.key)) ||
                    (mPropertyBag && (mPropertyBag.name || mPropertyBag.propertyKey)) ||
                    (mPropertyBag && mPropertyBag.property && (mPropertyBag.property.name || mPropertyBag.property.path || mPropertyBag.property.key));
                if (!sName) {
                    return Promise.reject("Invalid property for filter item");
                }

                let sDataType = "sap.ui.model.type.String";
                try {
                    const oModel = oTable.getModel();
                    const oMetaModel = oModel && oModel.getMetaModel && oModel.getMetaModel();
                    if (oMetaModel) {
                        const sCollectionPath = oTable.getPayload()?.collectionPath?.replace(/^\//, "") || "Customers";
                        const oProp = oMetaModel.getObject(`/${sCollectionPath}/${sName}`);
                        const sEdmType = oProp && oProp.$Type;
                        if (sEdmType === "Edm.Int16" || sEdmType === "Edm.Int32" || sEdmType === "Edm.Int64" || sEdmType === "Edm.Decimal") {
                            sDataType = "sap.ui.model.type.Integer";
                        } else if (sEdmType === "Edm.Boolean") {
                            sDataType = "sap.ui.model.type.Boolean";
                        } else if (sEdmType === "Edm.Date" || sEdmType === "Edm.DateTimeOffset") {
                            sDataType = "sap.ui.model.type.Date";
                        }
                    }
                } catch (e) { /* ignore */ }

                return Promise.resolve(new FilterField({
                    label: String(sName)
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, function(str) { return str.toUpperCase(); })
                        .trim(),
                    propertyKey: sName,
                    conditions: "{$filters>/conditions/" + sName + "}",
                    dataType: sDataType
                }));
            }
        };
    };

    return GenericTableDelegate;
});
