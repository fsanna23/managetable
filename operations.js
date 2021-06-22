/*  */

(requirejs.specified("base/js/namespace")
  ? define
  : function (deps, callback) {
      "use strict";
      // if here, the Jupyter namespace hasn't been specified to be loaded.
      // This means that we're probably embedded in a page, so we need to make
      // our definition with a specific module name
      return define("nbextensions/managetable/operations", deps, callback);
    })(
  ["jquery", "require", "nbextensions/managetable/chosenjs"],
  function ($, requirejs, chosenJs) {
    "use strict";

    let IPython;

    // Keep track of what operation is selected;
    let currentOp;

    try {
      // this will work in a live notebook because nbextensions & custom.js
      // are loaded by/after notebook.js, which requires base/js/namespace
      IPython = requirejs("base/js/namespace");
    } catch (err) {
      console.log("[managetable] working in non-live notebook", err);
    }
    let Jupyter = IPython;

    // Initialize chosenJs
    chosenJs.initializeChosenJs($, Jupyter);

    /* Execute Python code through kernel and get the result */
    const executePython = (pythonCode) => {
      return new Promise((resolve, reject) => {
        var callbacks = {
          iopub: {
            output: (data) => resolve(data.content.text.trim()),
          },
        };
        Jupyter.notebook.kernel.execute(`${pythonCode}`, callbacks);
      });
    };

    /* Parse code and makes it correct in Python. */
    const parseCode = (code) => {
      return code.replace(/^ +/gm, "");
    };

    /* Check if the DataFrame has been declared as 'df' */
    const checkDataFrame = () => {
      executePython("df in locals()").then((result) => {
        return result;
      });
    };

    /* UI create functions */

    const appendKeybordEvents = (element) => {
      element
        .on("focus", function () {
          Jupyter.keyboard_manager.disable();
        })
        .on("focusout", function () {
          Jupyter.keyboard_manager.enable();
        });
    };

    const createLabel = (label, className = null, isHidden = false) => {
      return $("<label />")
        .addClass("parameter-wrapper")
        .addClass(className)
        .append($("<span />").text(isHidden !== true ? label : ""));
    };

    const createTextField = (id, label, placeholder, classname = null) => {
      let newLabel = createLabel(label);
      let newInput = $("<input />")
        .attr("id", id !== "" ? id : null)
        .attr("type", "text")
        .attr("placeholder", placeholder)
        .addClass(classname);
      appendKeybordEvents(newInput);
      newLabel.append(newInput);
      $("#input-parameters-wrapper").append(newLabel);
      return newLabel;
    };

    const createNumberField = (
      id,
      label,
      placeholder,
      min,
      onChange = null
    ) => {
      let newLabel = createLabel(label);
      let newInput = $("<input />")
        .attr("id", id)
        .attr("type", "number")
        .attr("placeholder", placeholder)
        .attr("min", min)
        .on("change", onChange);
      appendKeybordEvents(newInput);
      newLabel.append(newInput);
      $("#input-parameters-wrapper").append(newLabel);
      return newLabel;
    };

    const createCheckBox = (id, classname = null, label, onChange = null) => {
      let newLabel = createLabel(label);
      let newInput = $("<input />")
        .attr("id", id)
        .attr("type", "checkbox")
        .addClass(classname);
      onChange !== null && newInput.on("change", onChange);
      newLabel.append(newInput);
      $("#input-parameters-wrapper").append(newLabel);
      return newLabel;
    };

    const createSelect = (
      id,
      classname,
      label,
      values,
      isMultiple = false,
      onChange = null
    ) => {
      let newLabel = createLabel(label);
      let newSelect = $("<select />").attr("id", id).addClass(classname);
      isMultiple === true &&
        newSelect.attr("multiple", true).attr("data-placeholder", label);
      // Se ho passato un onChange lo vado ad inserire
      onChange !== null && newSelect.on("change", onChange);
      /* Fare l'append dei values come nel managetable*/
      values.forEach((value) => {
        let newOption = $(`<option>${value}</option>`).attr("value", value);
        newSelect.append(newOption);
      });
      newLabel.append(newSelect);
      $("#input-parameters-wrapper").append(newLabel);
      isMultiple === true &&
        newSelect.chosen({ width: "200px" }) &&
        appendKeybordEvents(newSelect);
    };

    const createButton = (id, text, callback) => {
      let newButton = $("<button />")
        .attr("id", id !== "" ? id : null)
        .text(text)
        .on("click", callback);
      $("#input-parameters-wrapper").append(newButton);
    };

    const createTableSelector = (
      id = null,
      className = null,
      label = "Select your table",
      onChange = null
    ) => {
      getDataFrames().then((dfs) => {
        createSelect(id, className, label, dfs, false, onChange);
      });
    };

    /* The selectEl parameter must be a Jquery obj */
    const changeSelectOptions = (selectEl, newValues) => {
      selectEl.empty();
      newValues.forEach((value) => {
        let newOption = $(`<option>${value}</option>`).attr("value", value);
        selectEl.append(newOption);
      });
      selectEl.attr("multiple") === "multiple" &&
        selectEl.chosen("destroy") &&
        selectEl.chosen({ width: "200px" });
    };

    /* Inserts code into the notebook */
    const insert_code_to_nb = (code) => {
      const cells = Jupyter.notebook.get_cells();
      Jupyter.notebook.select(cells.length - 1);
      Jupyter.notebook.insert_cell_below("code").set_text(code.trim());
      Jupyter.notebook.execute_all_cells();
    };

    const insert_markdown_to_nb = (text) => {
      const cells = Jupyter.notebook.get_cells();
      Jupyter.notebook.select(cells.length - 1);
      Jupyter.notebook.insert_cell_below("markdown").set_text(text.trim());
      Jupyter.notebook.execute_all_cells();
    };

    const insert_code_and_markdown_to_nb = (code, md) => {
      let cells = Jupyter.notebook.get_cells();
      Jupyter.notebook.select(cells.length - 1);
      Jupyter.notebook.insert_cell_below("code").set_text(code.trim());
      cells = Jupyter.notebook.get_cells();
      Jupyter.notebook.select(cells.length - 1);
      Jupyter.notebook.insert_cell_below("markdown").set_text(md.trim());
      Jupyter.notebook.execute_all_cells();
    };

    /* Notebook cells parsing functions */

    const getColumnsFromTable = (dfName = "df") => {
      return executePython(`print(list(${dfName}.columns))`).then((result) => {
        return JSON.parse(result.replace(/'/g, '"'));
      });
    };

    const getRowIndices = (dfName = "df") => {
      return executePython(`print(list(${dfName}.index.values))`).then(
        (result) => {
          return JSON.parse(result.replace(/'/g, '"'));
        }
      );
    };

    const getCsvExcel = () => {
      const code = parseCode(`
      import os
      import re
      files = [f for f in os.listdir('.') if os.path.isfile(f) and re.match("^.*(csv|xlsx)$", f)]
      print(files)
      `);
      return executePython(code).then((result) => {
        return JSON.parse(result.replace(/'/g, '"'));
      });
    };

    const getDataFrames = () => {
      const code = parseCode(`
      mylist = []
      for var in vars().copy():
      \tif (isinstance(vars()[var], pd.DataFrame) and not var.startswith("_")):
      \t\tmylist.append(var)        
      print(mylist)`);
      return executePython(code).then((result) => {
        return JSON.parse(result.replace(/'/g, '"'));
      });
    };

    const getListVariables = () => {
      const code = `
      mylist = []
      for var in vars().copy():
      \tif (type(vars()[var]) == list and not var.startswith("_")):
      \t\tmylist.append(var)        
      print(mylist)`;
      return executePython(code).then((result) => {
        return JSON.parse(result.replace(/'/g, '"'));
      });
    };

    /* Main functions */

    const generalOps = [
      /* ID 1 - Import table */
      {
        id: 1,
        title: "Import table",
        description:
          "Import a table from a .csv or .xlsx (Microsoft Excel) file. The file must be in the same folder of the Notebook.",
        updates: false,
        create_input: function () {
          getCsvExcel().then((files) => {
            createSelect(
              "import-table-select",
              null,
              "Select your file",
              files,
              false
            );
          });
          createTextField(
            "import-table-name",
            "Give your table a name",
            "Table name",
            null
          );
        },
        insert_code: function () {
          const tableFile = $("#import-table-select").val();
          const tableOp = tableFile.endsWith("csv")
            ? `pd.read_csv('./${tableFile}', delimiter=';')`
            : `pd.read_excel('./${tableFile}')`;
          const tableName = $("#import-table-name").val();
          const code = `
      ${tableName} = ${tableOp}
      ${tableName}`;
          const markdown = `The table data contained in the file \`${tableFile}\` has been imported to the notebook. The table is inserted into the variable called \`${tableName}\`.`;
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
      /* ID 10 - Merge tables by column */
      {
        id: 10,
        title: "Merge tables by column",
        description:
          "Choose two tables and merge them by columns. \
          The columns of the second one will be placed right after the columns of the first one. \
          The two tables MUST have the same number of rows, or the concatenation will fail.",
        updates: true,
        create_input: function () {
          createTableSelector(
            "manager-select-df1",
            null,
            "Select the first table"
          );
          createTableSelector(
            "manager-select-df2",
            null,
            "Select the second table"
          );
        },
        insert_code: function () {
          const df1 = $("#manager-select-df1").val();
          const df2 = $("#manager-select-df2").val();
          const markdown = `The table called \`${df1}\` and the table called \`${df2}\` have been merged into a single table called \`${df1}\`.`;
          const code = `
          ${df1} = pd.concat([${df1}, ${df2}], axis=1)
          ${df1}`;
          // insert_code_to_nb(code);
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
      /* ID 12 - Filter and Multiply on condition */
      {
        id: 12,
        title: "Filter and multiply on condition",
        description:
          "Given a table and a list of values, \
      select a column of the table. For each value in the list, find each row on the table that contains \
      that value on the specified column and print it in order. If the list contains duplicate values, \
      they will also be printed, mantaining the list order.",
        updates: true,
        create_input: function () {
          const generateInput = (df) => {
            getColumnsFromTable(df).then((tableColumns) => {
              createSelect(
                "filter-multip-cols",
                null,
                "Select the indexing column",
                tableColumns,
                false,
                null
              );
            });
            getListVariables().then((listVars) => {
              createSelect(
                "filter-multip-list",
                null,
                "Select the list",
                listVars,
                false,
                null
              );
            });
          };

          getDataFrames().then((dfs) => {
            // create select
            createSelect(
              "manager-select-df",
              null,
              "Select your table",
              dfs,
              false,
              function () {
                const newValue = $("#manager-select-df").val();
                $("#manager-select-df").parent().nextAll().remove();
                generateInput(newValue);
              }
            );
            generateInput(dfs[0]);
          });
        },
        insert_code: function () {
          const df = $("#manager-select-df").val();
          const listVar = $("#filter-multip-list").val();
          const indexColumn = $("#filter-multip-cols").val();
          const markdown = `Filtered the table called \`${df}\`. The selected list of values is the one called \`${listVar}\`, \
        and the values in this list are searched in the column \`${indexColumn}\`.`;
          const code = `
      index_column = "${indexColumn}"
      temp_array = []
      for value in ${listVar}:
      \ttemp_array.extend(${df}.loc[${df}[index_column] == value].values.tolist())
      ${df} = pd.DataFrame(data=temp_array, columns=${df}.columns).convert_dtypes()
      ${df}`;
          // insert_code_to_nb(code);
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
    ];

    const columnOps = [
      /* ID 3 - Add indexing */
      {
        id: 3,
        title: "Add indexing",
        description:
          "Add a column to your table that will serve as indexing column, spanning from 1 to the number of rows the table has.",
        updates: true,
        create_input: function () {
          createTextField(
            "indexing-name-input",
            "Create indexing column",
            "Create indexing column"
          );
          createTableSelector(
            "manager-select-df",
            null,
            "Select a table",
            null
          );
        },
        insert_code: function () {
          const df = $("#manager-select-df").val();
          const colName = $("#indexing-name-input").val();
          const markdown = `The indexing column \`${colName}\` has been inserted into the table called \`${df}\``;
          const code = `indices = [x for x in range(1, len(${df}) + 1)]
          ${df}.insert(loc=0, column='${colName}', value=indices)
          ${df}`;
          // insert_code_to_nb(code.trim());
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
      /* ID 4  Cut columns */
      {
        id: 4,
        title: "Cut columns",
        description:
          "Creates new rows based on a subset of the table's columns. \
        The subset length is specified by the 'cutrange' numerical value. \
        You can also specify a subset of columns that will stay the same for each row that is created, \
        therefore replicating their values for each 'original' row that's split by this operation. ",
        updates: true,
        create_input: function () {
          getDataFrames().then((dfs) => {
            createSelect(
              "manager-select-df",
              null,
              "Select your table",
              dfs,
              false,
              function () {
                const newValue = $("#manager-select-df").val();
                console.log("The new value is: ", newValue);
                getColumnsFromTable(newValue).then((tableColumns) => {
                  const selectEl = $("#fixed-col-input");
                  changeSelectOptions(selectEl, tableColumns);
                });
              }
            );
            createNumberField("cut-range-input", "Cut range", "Cut range", 1);
            createCheckBox(
              "cut-order-checkbox",
              null,
              "Reorder the table by the fixed columns"
            );
            getColumnsFromTable(dfs[0]).then((tableColumns) => {
              createSelect(
                "fixed-col-input",
                "",
                "Fixed columns",
                tableColumns,
                true
              );
            });
          });
        },
        insert_code: function () {
          const df = $("#manager-select-df").val();
          const cutRange = $("#cut-range-input").val();
          const reorderTable =
            $("#cut-order-checkbox").is(":checked") === true ? "True" : "False";
          const fixedColumns = $("#fixed-col-input")
            .val()
            .map((el) => "'" + el + "'");
          let markdown = `The rows of the table \`${df}\` have been cut into \`${cutRange}\` parts, \
            creating \`${cutRange}\` new rows for each original row. `;
          if (fixedColumns.length > 0) {
            markdown += `The columns \`${fixedColumns}\` have not been cut, leaving their values for each new row deriving from the same original row. `;
          } else {
            markdown += `No column has been fixed: the cut included all columns of the table. `;
          }
          if (reorderTable === "True") {
            markdown += `The table has been reordered by index.`;
          } else {
            markdown += `The table has not been reordered.`;
          }
          const code = `import math
          fixed_columns = [${fixedColumns}]
          cut_range = ${cutRange}
          reorder_table = ${reorderTable}
          cols = [c for c in ${df} if c not in fixed_columns]
          cut_names = ["cut_" + str(index + 1) for index,value in enumerate(range(cut_range))]
          diff = len(cols) % cut_range
          if diff != 0:
          \tnum_add = cut_range - (len(cols) % cut_range)
          \tfor i in range(0, num_add):
          \t\tname = "newcol" + str(i)
          \t\tarray = np.empty(len(${df}))
          \t\tarray[:] = np.NaN
          \t\t${df}[name] = array
          if reorder_table is False:
          \tfixed_columns = ["index"] + fixed_columns
          \t${df}2 = ${df}.rename_axis("index").reset_index().set_index(fixed_columns).stack(dropna=False).reset_index(level=len(fixed_columns), drop=True).to_frame('Value')
          else:
          \t${df}2 = ${df}.set_index(fixed_columns).stack(dropna=False).reset_index(level=len(fixed_columns), drop=True).to_frame('Value')
          value_col = ${df}2["Value"].reset_index(drop=True)
          index_values = set([i for i in ${df}2.index.values])
          new_indices = list(val for val in index_values for _ in range(0, math.ceil(len(cols) / cut_range)))
          new_indices.sort()
          ${df}2 = pd.concat([pd.Series([v for v in value_col.loc[[(index - n) % len(cut_names) == 0 for index in value_col.index.values]]], name=col) for n, col in enumerate(cut_names)], axis=1)
          if len(fixed_columns) > 1:
          \tnew_indices = list(map(list, zip(*new_indices)))
          ${df}2 = ${df}2.set_index(pd.MultiIndex.from_arrays(new_indices if type(new_indices[0]) is list else [new_indices], names=(fixed_columns)))
          ${df} = ${df}2.reset_index()
          if reorder_table is False:
          \t${df} = ${df}.drop("index", axis=1)
          ${df}`;
          // insert_code_to_nb(code);
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
      /* ID 6 - Rename columns */
      {
        id: 6,
        title: "Rename columns",
        description: "Rename one or more table columns.",
        updates: true,
        create_input: function () {
          const selectChangeFun = (event) => {
            const thisEl = $(event.target);
            const thisIndex = $(".rename-col-table").index(thisEl);
            /*  Gli elementi con classe ".rename-col-table" sono i select. Li vado a selezionare tutti con JQuery
             *   e quindi vado a scorrerli.  */
            $(".rename-col-table").each(function (index) {
              /*  Devo agire solo sui select che non sono il primo, poiché saranno quelli in cui
                    vengono modificati i valori. Il primo rimane sempre uguale perchè contiene
                    tutti i valori. */
              if (index > thisIndex) {
                console.log("Changing options for select with index: ", index);
                /*  Elimino tutte le opzioni del select. */
                $(this).empty();
                /*  Prendo l'attuale valore selezionato del select prima di quello che sto analizzando. */
                const prevSelVal = $(".rename-col-table")
                  .eq(index - 1)
                  .val();
                console.log("The previous select has a value of: ", prevSelVal);
                /*  Prendo le opzioni del select prima di quello che sto analizzando. */
                const prevSelOpt = $(".rename-col-table")
                  .eq(index - 1)
                  .find("option");
                /*  Faccio il parsing delle opzioni in modo da prendere i loro valori, e quindi effettuo
                 *   il filtraggio per far si che vengano inseriti tutti i valori tranne quello selezionato
                 *   dal select precedente. */
                let values = $.map(prevSelOpt, function (option) {
                  return option.value;
                }).filter((el) => el !== prevSelVal);
                console.log("After filtering, the values are: ", values);
                /*  Per ogni valore (opzione) che ho trovato, vado a inserirlo nel select attuale. */
                values.forEach((value) => {
                  let newOption = $(`<option value=${value}>${value}</option>`);
                  $(this).append(newOption);
                });
              }
            });
          };

          getDataFrames().then((dfs) => {
            createSelect(
              "manager-select-df",
              null,
              "Select your table",
              dfs,
              false,
              function () {
                const newValue = $("#manager-select-df").val();
                $("#manager-select-df").parent().nextAll().remove();
                getColumnsFromTable(newValue).then((tableColumns) => {
                  createSelect(
                    "",
                    "rename-col-table",
                    "Rename this column",
                    tableColumns,
                    false,
                    selectChangeFun
                  );
                  createTextField(
                    "",
                    "with this new name",
                    "New column name",
                    "rename-cols-input"
                  );
                  tableColumns.length > 1 &&
                    createButton(
                      "rename-cols-add-btn",
                      "Rename another column",
                      function () {
                        getColumnsFromTable(newValue).then((tableColumns) => {
                          // Get the values of the other select
                          let valuesArray = [];
                          $(".rename-col-table").each(function () {
                            valuesArray.push($(this).val());
                          });
                          tableColumns.filter(
                            (el) => !valuesArray.includes(el)
                          );
                          createSelect(
                            "",
                            "rename-col-table",
                            "Rename this column",
                            tableColumns,
                            false,
                            selectChangeFun
                          );
                          createTextField(
                            "",
                            "with this new name",
                            "New column name",
                            "rename-cols-input"
                          );
                          if (tableColumns.length > 1) {
                            $("#rename-cols-add-btn")
                              .detach()
                              .appendTo("#input-parameters-wrapper");
                          } else {
                            $("#rename-cols-add-btn").remove();
                          }
                        });
                      }
                    );
                });
              }
            );
            getColumnsFromTable(dfs[0]).then((tableColumns) => {
              createSelect(
                "",
                "rename-col-table",
                "Rename this column",
                tableColumns,
                false,
                selectChangeFun
              );
              createTextField(
                "",
                "with this new name",
                "New column name",
                "rename-cols-input"
              );
              tableColumns.length > 1 &&
                createButton(
                  "rename-cols-add-btn",
                  "Rename another column",
                  function () {
                    getColumnsFromTable(dfs[0]).then((tableColumns) => {
                      // Get the values of the other select
                      let valuesArray = [];
                      $(".rename-col-table").each(function () {
                        valuesArray.push($(this).val());
                      });
                      tableColumns.filter((el) => !valuesArray.includes(el));
                      createSelect(
                        "",
                        "rename-col-table",
                        "Rename this column",
                        tableColumns,
                        false,
                        selectChangeFun
                      );
                      createTextField(
                        "",
                        "with this new name",
                        "New column name",
                        "rename-cols-input"
                      );
                      if (tableColumns.length > 1) {
                        $("#rename-cols-add-btn")
                          .detach()
                          .appendTo("#input-parameters-wrapper");
                      } else {
                        $("#rename-cols-add-btn").remove();
                      }
                    });
                  }
                );
            });
          });
        },
        insert_code: function () {
          const df = $("#manager-select-df").val();
          const columnsToRename = $.map(
            $(".rename-col-table"),
            function (option) {
              return option.value;
            }
          );
          const newNames = $.map($(".rename-cols-input"), function (el) {
            return el.value;
          });
          let renameObj = {};
          let markdown = `These are the columns of the table called \`${df}\` that have been renamed.\n\n`;
          columnsToRename.forEach((el, index) => {
            renameObj[el] = newNames[index];
            markdown += `The column \`${el}\` has been renamed \`${newNames[index]}\`.`;
            if (index !== columnsToRename.length - 1) markdown += `\n\n`;
          });
          renameObj = JSON.stringify(renameObj);
          const code = `
          ${df} = ${df}.rename(columns=${renameObj})
          ${df}
          `;
          // insert_code_to_nb(code);
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
      /* ID 7 - Move columns */
      {
        id: 7,
        title: "Move columns",
        description: "Move a column to another position in the table",
        updates: true,
        create_input: function () {
          getDataFrames().then((dfs) => {
            createSelect(
              "manager-select-df",
              null,
              "Select your table",
              dfs,
              false,
              function () {
                const newValue = $("#manager-select-df").val();
                $("#manager-select-df").parent().nextAll().remove();
                getColumnsFromTable(newValue).then((tableColumns) => {
                  const selectEl = $("#remove-rows-input");
                  createSelect(
                    "move-column-select-column",
                    null,
                    "Move this column",
                    tableColumns,
                    false,
                    function (event) {
                      /* Whenever a column is selected, it needs to be removed from the other selects. */
                      const newValue = event.target.value;
                      const newValues = tableColumns.filter(
                        (el) => el !== newValue
                      );
                      if (
                        $(
                          "#move-column-select-column-before, #move-column-select-column-after"
                        ).length !== 0
                      ) {
                        changeSelectOptions(
                          $(
                            "#move-column-select-column-before, #move-column-select-column-after"
                          ),
                          newValues
                        );
                      }
                    }
                  );
                  const moveOps = [
                    "Move after column",
                    "Move before column",
                    "Move at index",
                  ];
                  createSelect(
                    "move-column-select-op",
                    null,
                    "Choose how to move the column",
                    moveOps,
                    false,
                    function (event) {
                      // Current value
                      const selectedOp = event.target.value;
                      console.log("The event is: ", event);
                      console.log(
                        "The next all is ",
                        $(event.target)
                          .parent()
                          .nextAll(
                            "#move-column-select-column-before, #move-column-select-column-after, #move-column-select-column-index"
                          )
                      );
                      // Remove everything
                      $(event.target).parent().nextAll().remove();
                      if (
                        selectedOp === "Move after column" ||
                        selectedOp === "Move before column"
                      ) {
                        getColumnsFromTable().then((tableColumns) => {
                          const selectCol = $(
                            "#move-column-select-column"
                          ).val();
                          tableColumns = tableColumns.filter(
                            (el) => el !== selectCol
                          );
                          createSelect(
                            selectedOp === "Move before column"
                              ? "move-column-select-column-before"
                              : "move-column-select-column-after",
                            null,
                            selectedOp === "Move before column"
                              ? "Move before this column"
                              : "Move after this column",
                            tableColumns
                          );
                        });
                      } else {
                        getColumnsFromTable().then((tableColumns) => {
                          let cols = tableColumns.map((_, ix) => ix);
                          createSelect(
                            "move-column-select-column-index",
                            null,
                            "Move at this index",
                            cols
                          );
                        });
                      }
                    }
                  );
                  createSelect(
                    "move-column-select-column-after",
                    null,
                    "Move after this column",
                    tableColumns.filter((el) => el !== tableColumns[0])
                  );
                });
              }
            );
            getColumnsFromTable(dfs[0]).then((tableColumns) => {
              createSelect(
                "move-column-select-column",
                null,
                "Move this column",
                tableColumns,
                false,
                function (event) {
                  /* Whenever a column is selected, it needs to be removed from the other selects. */
                  const newValue = event.target.value;
                  const newValues = tableColumns.filter(
                    (el) => el !== newValue
                  );
                  if (
                    $(
                      "#move-column-select-column-before, #move-column-select-column-after"
                    ).length !== 0
                  ) {
                    changeSelectOptions(
                      $(
                        "#move-column-select-column-before, #move-column-select-column-after"
                      ),
                      newValues
                    );
                  }
                }
              );
              const moveOps = [
                "Move after column",
                "Move before column",
                "Move at index",
              ];
              createSelect(
                "move-column-select-op",
                null,
                "Choose how to move the column",
                moveOps,
                false,
                function (event) {
                  // Current value
                  const selectedOp = event.target.value;
                  console.log("The event is: ", event);
                  console.log(
                    "The next all is ",
                    $(event.target)
                      .parent()
                      .nextAll(
                        "#move-column-select-column-before, #move-column-select-column-after, #move-column-select-column-index"
                      )
                  );
                  // Remove everything
                  $(event.target).parent().nextAll().remove();
                  if (
                    selectedOp === "Move after column" ||
                    selectedOp === "Move before column"
                  ) {
                    getColumnsFromTable().then((tableColumns) => {
                      const selectCol = $("#move-column-select-column").val();
                      tableColumns = tableColumns.filter(
                        (el) => el !== selectCol
                      );
                      createSelect(
                        selectedOp === "Move before column"
                          ? "move-column-select-column-before"
                          : "move-column-select-column-after",
                        null,
                        selectedOp === "Move before column"
                          ? "Move before this column"
                          : "Move after this column",
                        tableColumns
                      );
                    });
                  } else {
                    getColumnsFromTable().then((tableColumns) => {
                      let cols = tableColumns.map((_, ix) => ix);
                      createSelect(
                        "move-column-select-column-index",
                        null,
                        "Move at this index",
                        cols
                      );
                    });
                  }
                }
              );
              createSelect(
                "move-column-select-column-after",
                null,
                "Move after this column",
                tableColumns.filter((el) => el !== tableColumns[0])
              );
            });
          });
        },
        insert_code: function () {
          const df = $("#manager-select-df").val();
          getColumnsFromTable(df).then((tableColumns) => {
            let cols = tableColumns;
            const colToMove = $("#move-column-select-column").val();
            const sourceColIndex = cols.indexOf(colToMove);
            let markdown = `The column \`${colToMove}\` in the table called \`${df}\` has been moved `;
            const moveType = $("#move-column-select-op").val();
            let destColIndex;
            if (
              moveType === "Move after column" ||
              moveType === "Move before column"
            ) {
              const destCol = $(
                "#move-column-select-column-before, #move-column-select-column-after"
              ).val();
              destColIndex = cols.indexOf(destCol);
              if (moveType === "Move after column") {
                destColIndex++;
                markdown += `after the column \`${destCol}\`.`;
              } else {
                markdown += `before the column \`${destCol}\``;
              }
            } else {
              destColIndex = $("#move-column-select-column-index").val();
              markdown += `at index \`${destColIndex}\``;
            }
            cols.splice(destColIndex, 0, cols.splice(sourceColIndex, 1)[0]);
            cols = JSON.stringify(cols);
            const code = `
            ${df} = ${df}[${cols}]
            ${df}
            `;
            // insert_code_to_nb(code);
            const parsedCode = parseCode(code);
            insert_code_and_markdown_to_nb(parsedCode, markdown);
          });
        },
      },
      /* ID 9 - Melt table */
      {
        id: 9,
        title: "Melt table",
        description:
          "Collapse a subset of columns of a table into a single column, leaving another subset as fixed columns. \
            You'll need to specify the fixed columns and then select among them the indexing columns, which will create \
            the final table ordering.",
        updates: true,
        create_input: function () {
          const generateInput = (df) => {
            getColumnsFromTable(df).then((tableColumns) => {
              // Select the fixed columns
              createSelect(
                "melt-table-fixed-cols",
                null,
                "Select the fixed columns",
                tableColumns,
                true,
                function () {
                  // Among those fixed columns, select which to use as index
                  // Inserted in the onChange function so that until something is selected it doesn't show
                  const selectedValues = $("#melt-table-fixed-cols").val();
                  const selectEl = $("#melt-table-index-cols");
                  if (selectEl.length === 0) {
                    /* We don't have yet the second select, we create it now */
                    createSelect(
                      "melt-table-index-cols",
                      null,
                      "Select the index columns",
                      selectedValues,
                      true,
                      null
                    );
                  } else {
                    changeSelectOptions(selectEl, selectedValues);
                  }
                }
              );
            });
          };

          getDataFrames().then((dfs) => {
            createSelect(
              "manager-select-df",
              null,
              "Select your table",
              dfs,
              false,
              function () {
                const newValue = $("#manager-select-df").val();
                $("#manager-select-df").parent().nextAll().remove();
                generateInput(newValue);
              }
            );

            generateInput(dfs[0]);
          });
        },
        insert_code: function () {
          const df = $("#manager-select-df").val();
          const fixedColumns = $("#melt-table-fixed-cols")
            .val()
            .map((el) => "'" + el + "'");
          const indexColumns = $("#melt-table-index-cols")
            .val()
            .map((el) => "'" + el + "'");
          const markdown = `Melted the columns of the table called \`${df}\`. The fixed columns that have been selected are \`${fixedColumns}\` and the indexing columns are \`${indexColumns}\`.`;
          const code = `
          fixed_columns = [${fixedColumns}]
          index_columns = [${indexColumns}, "index"]
          ${df} = pd.melt(${df}, id_vars=fixed_columns, value_name="col").drop(["variable"], axis=1).rename_axis("index").sort_values(by=index_columns).reset_index().drop(["index"], axis=1)
          ${df}`;
          // insert_code_to_nb(code);
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
      /* ID 11 - Extract column values on condition */
      {
        id: 11,
        title: "Extract column values on condition",
        description:
          "Given a table, select two columns. For each value of the first column, \
          search every value of the second column and return them as a list.",
        updates: true,
        create_input: function () {
          const generateInput = (df) => {
            getColumnsFromTable(df).then((tableColumns) => {
              createSelect(
                "extract-values-index",
                null,
                "For each value in",
                tableColumns,
                false,
                function () {
                  const selectedValue = $("#extract-values-index").val();
                  const remainingCols = tableColumns.filter(
                    (el) => el !== selectedValue
                  );
                  const selectEl = $("#extract-values-column");
                  if (selectEl.length === 0) {
                    /* We don't have yet the second select, we create it now */
                    createSelect(
                      "extract-values-column",
                      null,
                      "search all the values in",
                      remainingCols,
                      false,
                      null
                    );
                  } else {
                    changeSelectOptions(selectEl, remainingCols);
                  }
                }
              );
            });
          };
          getDataFrames().then((dfs) => {
            createSelect(
              "manager-select-df",
              null,
              "Select your table",
              dfs,
              false,
              function () {
                const newValue = $("#manager-select-df").val();
                $("#manager-select-df").parent().nextAll().remove();
                generateInput(newValue);
              }
            );
            generateInput(dfs[0]);
          });
        },
        insert_code: function () {
          const df = $("#manager-select-df").val();
          const indexColumn = $("#extract-values-index").val();
          const searchColumn = $("#extract-values-column").val();
          const markdown = `Searched the values in the column \`${searchColumn}\` in the table called \`${df}\`. The values have been indexed using the column \`${indexColumn}\``;
          const code = `
          index_column = "${indexColumn}"
          search_column = "${searchColumn}"
          value_list = [${df}.loc[${df}[index_column] == x].iloc[0].loc[search_column] for x in list(set(${df}[index_column]))]
          value_list`;
          // insert_code_to_nb(code);
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
      /* ID 13 - Parse column values (string) */
      {
        id: 13,
        title: "Parse column values (strings)",
        description:
          "Given a table, select one or more columns containing only string values. \
          Select then a string operation to do to each one of the values in those columns.",
        updates: false,
        create_input: function () {
          const generateInput = (df) => {
            getColumnsFromTable(df).then((tableColumns) => {
              createSelect(
                "parse-string-col",
                null,
                "Select the column",
                tableColumns,
                true,
                null
              );
              // TODO: expand operations
              const ops = [
                "Remove first character",
                "Remove last character",
                "Leave only first character",
                "Leave only last character",
              ];
              createSelect(
                "parse-string-op",
                null,
                "Select the operation",
                ops,
                false,
                null
              );
            });
          };
          getDataFrames().then((dfs) => {
            createSelect(
              "manager-select-df",
              null,
              "Select your table",
              dfs,
              false,
              function () {
                const newValue = $("#manager-select-df").val();
                $("#manager-select-df").parent().nextAll().remove();
                generateInput(newValue);
              }
            );
            generateInput(dfs[0]);
          });
        },
        insert_code: function () {
          const df = $("#manager-select-df").val();
          const columns = $("#parse-string-col")
            .val()
            .map((el) => "'" + el + "'");
          const op = $("#parse-string-op").val();
          let markdown = `Parsed the string values in the table called \`${df}\`. The values have been searched in the column`;
          if (columns.length > 1) {
            markdown += "s";
          }
          markdown += ` \`${columns}\`. For each string found, it has been `;
          let pythonOp;
          switch (op) {
            case "Remove first character":
              pythonOp = "[1:]";
              markdown += `removed the first letter.`;
              break;
            case "Remove last character":
              pythonOp = "[:-1]";
              markdown += `removed the last letter.`;
              break;
            case "Leave only first character":
              pythonOp = "[1]";
              markdown += `removed everything but the first letter.`;
              break;
            case "Leave only last character":
              pythonOp = "[-1]";
              markdown += `removed everything but the last letter.`;
              break;

            default:
              break;
          }
          const code = `
          columns = [${columns}]
          for col in columns:
          \t${df}.loc[:, col] = ${df}.loc[:, col].map(lambda x: x${pythonOp})
          ${df}`;
          // insert_code_to_nb(code);
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
    ];

    const rowOps = [
      /* ID 2 - Remove rows */
      {
        id: 2,
        title: "Remove rows",
        description:
          "Remove one or more rows from your table, specifying their indices.",
        updates: true,
        create_input: function () {
          // createTableSelector(undefined, null);
          getDataFrames().then((dfs) => {
            createSelect(
              "manager-select-df",
              null,
              "Select your table",
              dfs,
              false,
              function () {
                const newValue = $("#manager-select-df").val();
                console.log("The new value is: ", newValue);
                getRowIndices(newValue).then((tableRowIndices) => {
                  const selectEl = $("#remove-rows-input");
                  changeSelectOptions(selectEl, tableRowIndices);
                });
              }
            );
            getRowIndices(dfs[0]).then((tableRowIndices) =>
              createSelect(
                "remove-rows-input",
                "",
                "Remove rows",
                tableRowIndices,
                true
              )
            );
          });
        },
        insert_code: function () {
          const df = $("#manager-select-df").val();
          const rowIndices = $("#remove-rows-input").val();
          const markdown = `The rows with indices \`${rowIndices}\` have been removed from the table called \`${df}\``;
          const code = `${df} = ${df}.drop([${rowIndices}]).reset_index(drop=True)
      ${df}`;
          // insert_code_to_nb(code.trim());
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
      /* ID 5 - Remove NaN Rows */
      {
        id: 5,
        title: "Remove NaN rows",
        description:
          "Remove the rows in the table containing one or more NaN (Not a Number) values.",
        updates: true,
        create_input: function () {
          createTableSelector(
            "manager-select-df",
            null,
            "Select a table",
            null
          );
        },
        insert_code: function () {
          const df = $("#manager-select-df").val();
          const markdown = `The rows in the table \`${df}\` containing NaN values have been removed.`;
          const code = `
      ${df} = ${df}.dropna()
      ${df} = ${df}.reset_index(drop=True)
      ${df}`;
          // insert_code_to_nb(code);
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
      /* ID 8 - Expand row */
      {
        id: 8,
        title: "Expand row",
        description:
          "Replace a list of values in your table, specifying in which columns to search them, with another list of values (a vector). \
      The new values will be spread into different columns.",
        updates: true,
        create_input: function () {
          const createHiddenLabelTextField = (
            id,
            label,
            placeholder,
            classname = null,
            append = true
          ) => {
            let newLabel = createLabel(label, "expand-row-hidden-label", true);
            let newInput = $("<input />")
              .attr("id", id !== "" ? id : null)
              .attr("type", "text")
              .attr("placeholder", placeholder)
              .addClass(classname);
            appendKeybordEvents(newInput);
            newLabel.append(newInput);
            append === true && $("#input-parameters-wrapper").append(newLabel);
            return newLabel;
          };
          const generateInput = (df) => {
            getColumnsFromTable(df).then((tableColumns) => {
              createSelect(
                "expand-row-cols-select",
                null,
                "Select the values in the following columns",
                tableColumns,
                true,
                null
              );
              let numFieldLabel = createNumberField(
                "expand-row-matrix-dimens",
                "How many values will replace your actual values?",
                "Number of values",
                1,
                function (event) {
                  /* Whenever the value changes, search for the replace values inputs and substitute them
            with the correct amount of inputs, based on the value of this numerical input. */
                  const newNumber = Number(event.target.value);
                  const inputValues = $(".expand-row-value-name");
                  if (inputValues.length === 1) {
                    // Every element .expand-row-new-value is for the same current value
                    let newValues = $(".expand-row-new-value");
                    console.log("Printing newValues: ", newValues);
                    const difference = Math.abs(newValues.length - newNumber);
                    console.log("The difference is: ", difference);
                    if (newValues.length < newNumber) {
                      // Add values
                      const parentLabel = newValues.last().parent();
                      console.log("The parent label is: ", parentLabel);
                      for (const _ of Array(difference).keys()) {
                        console.log("Adding to parentLabel");
                        parentLabel.after(
                          createHiddenLabelTextField(
                            null,
                            "with these values",
                            "New value",
                            "expand-row-new-value",
                            false
                          )
                        );
                      }
                    }
                    if (newValues.length > newNumber) {
                      // Remove values
                      newValues.slice(newNumber).remove();
                    }
                  } else {
                    // We have more input values and we need to get the right .expand-row-new-value for each one of them
                    inputValues.each(function (index) {
                      const parentLabel = $(this).parent();
                      let newValuesEl;
                      if (index !== inputValues.length - 1) {
                        newValuesEl = parentLabel.nextUntil(
                          "label:has(.expand-row-value-name)"
                        );
                      } else {
                        /* Last element, all the following .expand-row-new-value are for this el
                  and we don't have to search the next element. */
                        newValuesEl = parentLabel.nextAll("label");
                      }
                      const difference = Math.abs(
                        newValuesEl.length - newNumber
                      );
                      if (newValuesEl.length < newNumber) {
                        // Add values
                        const lastEl = newValuesEl.last();
                        for (const _ of Array(difference).keys()) {
                          lastEl.after(
                            createHiddenLabelTextField(
                              null,
                              "with these values",
                              "New value",
                              "expand-row-new-value",
                              false
                            )
                          );
                        }
                      }
                      if (newValuesEl.length > newNumber) {
                        // Remove values
                        newValuesEl.slice(newNumber).remove();
                      }
                    });
                  }
                }
              );
              // Wrap the text
              numFieldLabel.css("white-space", "normal");
              // Default number value
              numFieldLabel.find("input").attr("value", 1);
              // Creating first inputs
              createTextField(
                null,
                "Replace this value",
                "Value name",
                "expand-row-value-name"
              );
              createTextField(
                null,
                "with these values",
                "New value",
                "expand-row-new-value"
              );
              createButton(
                "expand-row-add-value",
                "Add new value",
                function () {
                  /* Add a new couple Value-Replacement with the correct number of replacement inputs
          (based on the numerical value) and move the current button at the end. */
                  createTextField(
                    null,
                    "Replace this value",
                    "Value name",
                    "expand-row-value-name"
                  );
                  const numValues = $("#expand-row-matrix-dimens").val();
                  for (const i of Array(Number(numValues)).keys()) {
                    console.log("For loop with index: ", i);
                    if (i === 0) {
                      console.log("Creating standard field");
                      createTextField(
                        null,
                        "with these values",
                        "New value",
                        "expand-row-new-value"
                      );
                    } else {
                      console.log("Creating hidden field");
                      createHiddenLabelTextField(
                        null,
                        "with these values",
                        "New value",
                        "expand-row-new-value"
                      );
                    }
                  }
                  $("#expand-row-add-value")
                    .detach()
                    .appendTo($("#input-parameters-wrapper"));
                }
              );
            });
          };

          getDataFrames().then((dfs) => {
            createSelect(
              "manager-select-df",
              null,
              "Select your table",
              dfs,
              false,
              function () {
                const newValue = $("#manager-select-df").val();
                $("#manager-select-df").parent().nextAll().remove();
                generateInput(newValue);
              }
            );
            generateInput(dfs[0]);
          });
        },
        insert_code: function () {
          const df = $("#manager-select-df").val();
          const searchCols = JSON.stringify($("#expand-row-cols-select").val());
          const prev = $(".expand-row-value-name");
          let markdown = `Expanded rows in the table called \`${df}\`. The values have been searched in the columns \`${searchCols}\`. These are the replacement made:\n\n`;
          const prevValues = $.map(prev, function (el) {
            return el.value;
          });
          // .map((el) => parseValue(el));
          console.log("The prevvalues are", prevValues);
          const newValues = $.map(prev, function (el) {
            return [
              $.map(
                $(el).parent().nextUntil("label:has(.expand-row-value-name)"),
                function (label) {
                  return $(label).find("input").val();
                }
              ),
            ];
          });
          prevValues.forEach((val, index) => {
            markdown += `The value \`${val}\` has been replaced with this vector \`${newValues[index]}\`.`;
            if (index !== prevValues.length - 1) markdown += `\n\n`;
          });
          const code = `
      columns = ${searchCols}
      values = ${JSON.stringify(prevValues)}
      matrix = ${JSON.stringify(newValues)}
      len_first = len(matrix[0]) if matrix else None
      sort_cols = [c for c in ${df} if c not in columns]
      matrix_dict = {}
      for index, value in enumerate(values):
      \tmatrix_dict[value] = matrix[index] 
      mask = ${df}[columns].isin(values).any(1)
      ${df}2 = ${df}.reindex(${df}[mask].index.repeat(len_first)).reset_index(drop=True)
      for index, row in ${df}2.iterrows():
      \tfor col in columns:
      \t\t${df}2.loc[index, col] = matrix_dict[str(${df}2.at[index, col])][index % len_first]
      ${df}2 = ${df}2.append(${df}[~mask])
      ${df} = ${df}2.sort_values(by=sort_cols).reset_index(drop=True)
      ${df}`;
          // insert_code_to_nb(code);
          const parsedCode = parseCode(code);
          insert_code_and_markdown_to_nb(parsedCode, markdown);
        },
      },
    ];

    const operations = {
      general: generalOps,
      columns: columnOps,
      rows: rowOps,
    };

    return {
      get_operations: function (category) {
        return operations[category].map((op) => {
          return { id: op.id, title: op.title };
        });
      },
      insert_python_code: function (value, category) {
        let op = operations[category].find((el) => el.id === Number(value));
        op.insert_code();
      },
      append_parameters: function (value, category) {
        console.log("The category passed is", category);
        const op = operations[category].find((el) => el.id === Number(value));
        if (
          (currentOp === Number(value) && op.updates === true) ||
          currentOp !== Number(value)
        ) {
          currentOp = Number(value); // set current operation ID
          $("#input-parameters-wrapper").empty(); // Empty the parameters container
          $("#option-description-wrapper").text(op.description); // Set the description
          op.create_input();
        }
      },
    };
  }
);

if (!requirejs.specified("base/js/namespace")) {
  window.oplib = function () {
    "use strict";
    // use require to ensure the module is correctly loaded before the
    // actual call is made
    requirejs(["nbextensions/managetable/operations"], function (managetable) {
      return managetable;
    });
  };
}
