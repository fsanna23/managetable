(requirejs.specified("base/js/namespace")
  ? define
  : function (deps, callback) {
      "use strict";
      // if here, the Jupyter namespace hasn't been specified to be loaded.
      // This means that we're probably embedded in a page, so we need to make
      // our definition with a specific module name
      return define("nbextensions/managetable/managetable", deps, callback);
    })(
  ["jquery", "require", "nbextensions/managetable/operations"],
  function ($, requirejs, oplib) {
    "use strict";

    // Main Variables
    var IPython;
    var events;
    var liveNotebook = false;

    // Configuration values
    // default values for system-wide configurable parameters
    var default_cfg = {
      colors: {
        wrapper_background: "#FFFFFF",
        sidebar_border: "#EEEEEE",
      },
      moveMenuLeft: true,
      threshold: 4,
      widenNotebook: false,
    };
    // default values for per-notebook configurable parameters
    var metadata_settings = {
      nav_menu: {},
      sideBar: true,
      base_numbering: 1,
      title_cell: "Table Manager",
      title_sidebar: "Manage table",
      manager_cell: false,
      manager_position: {},
      manager_section_display: true,
      manager_window_display: false,
    };
    $.extend(true, default_cfg, metadata_settings);

    // manager_position default also serves as the defaults for a non-live notebook
    var manager_position = {
      height: "calc(100% - 180px)",
      width: "20%",
      left: "10px",
      top: "150px",
    };

    // Functions

    var read_config = function () {
      var cfg = default_cfg;
      // config may be specified at system level or at document level.
      // first, update defaults with config loaded from server
      $.extend(true, cfg, IPython.notebook.config.data.managetable);
      // ensure notebook metadata has toc object, cache old values
      var md = IPython.notebook.metadata.managetable || {};
      // reset notebook metadata to remove old values
      IPython.notebook.metadata.managetable = {};
      // then update cfg with any found in current notebook metadata
      // and save in nb metadata (then can be modified per document)
      Object.keys(metadata_settings).forEach(function (key) {
        cfg[key] = IPython.notebook.metadata.managetable[key] = (
          md.hasOwnProperty(key) ? md : cfg
        )[key];
      });
      return cfg;
    };

    try {
      // this will work in a live notebook because nbextensions & custom.js
      // are loaded by/after notebook.js, which requires base/js/namespace
      IPython = requirejs("base/js/namespace");
      events = requirejs("base/js/events");
      liveNotebook = true;
    } catch (err) {
      // We *are* theoretically in a non-live notebook
      console.log("[managetable] working in non-live notebook", err);
      // in non-live notebook, there's no event structure, so we make our own
      if (window.events === undefined) {
        var Events = function () {};
        window.events = $([new Events()]);
      }
      events = window.events;
    }
    var Jupyter = IPython;

    var setMd = function (key, value) {
      if (liveNotebook) {
        var md = IPython.notebook.metadata.managetable;
        if (md === undefined) {
          md = IPython.notebook.metadata.managetable = {};
        }
        var old_val = md[key];
        md[key] = value;
        if (
          typeof _ !== undefined ? !_.isEqual(value, old_val) : old_val != value
        ) {
          IPython.notebook.set_dirty();
        }
      }
      return value;
    };

    /* Salva la posizione della sidebar */
    var saveManagerPosition = function () {
      var manager_wrapper = $("#manager-wrapper");
      var new_values = manager_wrapper.hasClass("sidebar-wrapper")
        ? ["width"]
        : ["left", "top", "height", "width"];
      $.extend(manager_position, manager_wrapper.css(new_values));
      setMd("manager_position", manager_position);
    };

    /* Per attivare / disattivare l'estensione tramite il tasto */
    var makeUnmakeMinimized = function (cfg, animate) {
      var open = cfg.sideBar || cfg.manager_section_display;
      var new_css,
        wrap = $("manager-wrapper");
      var anim_opts = { duration: animate ? "fast" : 0 };
      if (open) {
        $("#manager").show();
        new_css = cfg.sideBar
          ? {}
          : { height: manager_position.height, width: manager_position.width };
      } else {
        new_css = {
          height: wrap.outerHeight() - wrap.find("#manager").outerHeight(),
        };
        anim_opts.complete = function () {
          $("#manager").hide();
          $("#manager-wrapper").css("width", "");
        };
      }
      wrap
        .toggleClass("closed", !open)
        .animate(new_css, anim_opts)
        .find(".hide-btn")
        .attr("title", open ? "Hide Manager" : "Show Manager");
      return open;
    };

    function setNotebookWidth(cfg, st) {
      var margin = 20;
      var nb_inner = $("#notebook-container");
      var nb_wrap_w = $("#notebook").width();
      var sidebar = $("#manager-wrapper");
      var visible_sidebar = cfg.sideBar && sidebar.is(":visible");
      var sidebar_w = visible_sidebar ? sidebar.outerWidth() : 0;
      var available_space = nb_wrap_w - 2 * margin - sidebar_w;
      var inner_css = { marginLeft: "", width: "" };
      if (cfg.widenNotebook) {
        inner_css.width = available_space;
      }
      if (visible_sidebar) {
        var nb_inner_w = nb_inner.outerWidth();
        if (available_space <= nb_inner_w + sidebar_w) {
          inner_css.marginLeft = sidebar_w + margin; // shift notebook rightward to fit the sidebar in
          if (available_space <= nb_inner_w) {
            inner_css.width = available_space; // also slim notebook to fit sidebar
          }
        }
      }
      nb_inner.css(inner_css);
    }

    var create_manager_div = function (cfg, st) {
      var callbackPageResize = function (evt) {
        setNotebookWidth(cfg);
      };

      var manager_wrapper = $('<div id="manager-wrapper"/>')
        .css("display", "none")
        .append(
          $('<div id="manager-header"/>')
            .append('<span class="header"/>')
            .append(
              $('<i class="fa fa-fw fa-refresh" title="Reload Manager">').on(
                "click",
                function (evt) {
                  var icon = $(evt.currentTarget).addClass("fa-spin");
                  eventListenerFun(false, "Reloaded Manager");
                  icon.removeClass("fa-spin");
                }
              )
            )
        )
        .append($("<div/>").attr("id", "manager").addClass("manager"))
        .prependTo(liveNotebook ? "#site" : document.body);

      manager_wrapper.resizable({
        handles: "all",
        resize: function (event, ui) {
          if (cfg.sideBar) {
            // unset the height set by jquery resizable
            $("#manager-wrapper").css("height", "");
            setNotebookWidth(cfg, st);
          }
        },
        start: function (event, ui) {
          if (!cfg.sideBar) {
            cfg.manager_section_display = setMd(
              "manager_section_display",
              true
            );
            makeUnmakeMinimized(cfg);
          }
        },
        stop: saveManagerPosition,
        containment: "parent",
        minHeight: 100,
        minWidth: 165,
      });

      // On header/menu/toolbar resize, resize the toc itself
      $(window).on("resize", callbackPageResize);
      if (liveNotebook) {
        events.on("resize-header.Page", callbackPageResize);
        $.extend(
          manager_position,
          IPython.notebook.metadata.managetable.manager_position
        );
      } else {
        // default to true for non-live notebook
        cfg.manager_window_display = true;
      }
    };

    /* Execute python code into the kernel */
    const executePython = (pythonCode) => {
      return new Promise((resolve) => {
        var callbacks = {
          iopub: {
            output: (data) => {
              try {
                resolve(data.content.text.trim());
              } catch (error) {
                console.error("Error", error, "\nReturned data:", data);
              }
            },
          },
        };
        try {
          Jupyter.notebook.kernel.execute(`${pythonCode}`, callbacks);
        } catch (error) {
          console.error("Error executing python code: ", pythonCode);
        }
      });
    };

    /* Check if the Pandas library has been declared as 'pd' */
    const checkPandas = () => {
      return executePython("print('pd' in locals())").then((result) => {
        if (result === "False") return false;
        return true;
        // Promise.resolve;
      });
    };

    /* Check if there are any DataFrames */
    const checkDataFrames = () => {
      return executePython(`
mylist = []
for var in vars().copy():
    if (isinstance(vars()[var], pd.DataFrame) and not var.startswith("_")):
        mylist.append(var)
        
print(len(mylist) != 0)`).then((result) => {
        try {
          return result === "False" ? false : true;
        } catch (error) {
          console.log(error, "parsing data frames, the result is:", result);
        }
        // return result;
      });
    };

    /* Check if there is a variable 'df' */
    const checkDfVar = () => {
      return executePython("print('df' in locals())").then((result) => {
        if (result === "False") return false;
        return true;
        // Promise.resolve(result);
      });
    };

    /* Check if the variable df is a DataFrame */
    const checkDfIsDataFrame = () => {
      return executePython("print(isinstance(df, pd.DataFrame))").then(
        (result) => {
          if (result === "False") return false;
          return true;
          // Promise.resolve(result);
        }
      );
    };

    const appendKeybordEvents = (element) => {
      element
        .on("focus", function () {
          Jupyter.keyboard_manager.disable();
        })
        .on("focusout", function () {
          Jupyter.keyboard_manager.enable();
        });
    };

    /* Events checker */

    const oldOnEventCheckPandasAndDf = () => {
      return new Promise((resolve) => {
        Promise.all([checkPandas(), checkDfVar()]).then((values) => {
          if (values[0] === false) {
            resolve(false);
            $("#option-description-wrapper").text(
              "You have to first import the 'pandas' library as variable 'pd'."
            );
          } else if (values[1] === false) {
            resolve(false);
            $("#option-description-wrapper").text(
              "You have to declare a 'df' variable."
            );
          } else {
            checkDfIsDataFrame().then((result) => {
              if (result === false) {
                $("#option-description-wrapper").text(
                  "A 'df' variable has been detected, \
                  but it's not an instance of the DataFrame class."
                );
                resolve(false);
              } else {
                resolve(true);
              }
            });
          }
        });
      });
    };

    const insertCodeToNotebook = (code) => {
      const cells = Jupyter.notebook.get_cells();
      Jupyter.notebook.select(cells.length - 1);
      Jupyter.notebook.insert_cell_below("code").set_text(code.trim());
      Jupyter.notebook.execute_all_cells();
    };

    /* Import libraries button */
    const helperBtnImports = $("<button />")
      .text("Import main libraries")
      .attr("id", "btn-import-pandas")
      .on("click", function () {
        /* insert python code with imports */
        /* also remove this button from the page */
        console.log("Pressed button imports");
        insertCodeToNotebook(
          `
import pandas as pd
import numpy as np
import math`
        );
        $("#btn-import-pandas").remove();
      });

    /* Import table button */
    const helperBtnDf = $("<button />")
      .text("Import table")
      .attr("id", "btn-before-import-df")
      .on("click", function () {
        /* Find out the files in this folder */
        console.log("Clicked import table");
        executePython(`
import os
import re
files = [f for f in os.listdir('.') if os.path.isfile(f) and re.match("^.*(csv|xlsx)$", f)]
print(files)
`).then((fileValues) => {
          console.log("The file values are: ", fileValues);
          fileValues = JSON.parse(fileValues.replace(/'/g, '"'));

          /* Display the three inputs */
          $("#select-import-df").empty();
          $("#text-import-df").text("");
          $("#helper-inputs-container").css(
            "display",
            $("#helper-inputs-container").css("display") === "none"
              ? "flex"
              : "none"
          );
          /* Append values to select */
          fileValues.forEach((value) => {
            $("#select-import-df").append(
              $(`<option>${value}</option>`).attr("value", value)
            );
          });
        });
      })
      .add(
        $("<div />")
          .attr("id", "helper-inputs-container")
          .css("display", "none")
          .css("margin-top", "5px")
          .append(
            $("<label />")
              .text("Select the table you want to import")
              .append($("<select />").attr("id", "select-import-df"))
              .add(
                $("<label />")
                  .text("Give your table a name")
                  .append(
                    $("<input />")
                      .attr("type", "text")
                      .attr("placeholder", "Table name")
                      .attr("id", "text-import-df")
                      .on("focus", function () {
                        Jupyter.keyboard_manager.disable();
                      })
                      .on("focusout", function () {
                        Jupyter.keyboard_manager.enable();
                      })
                  )
              )
              .add(
                $("<button />")
                  .text("Import to Notebook")
                  .attr("id", "btn-import-df")
                  .on("click", function () {
                    const tableFile = $("#select-import-df").val();
                    const tableOp = tableFile.endsWith("csv")
                      ? `pd.read_csv('./${tableFile}', delimiter=';')`
                      : `pd.read_excel('./${tableFile}')`;
                    const tableName = $("#text-import-df").val();
                    insertCodeToNotebook(`
${tableName} = ${tableOp}
${tableName}`);
                  })
              )
          )
      );

    const onEventCheckPandasAndDf = () => {
      return new Promise((resolve) => {
        checkPandas().then((value) => {
          if (value === false) {
            console.log("Check pandas is false");
            resolve(false);
            $("#option-description-wrapper").text(
              "You have to first import the 'pandas' library."
            );
            /* Add button to import pandas, numpy and math*/
            $("#helper-buttons-wrapper")
              .empty()
              .append(helperBtnImports)
              .append(helperBtnDf);
          } else {
            checkDataFrames().then((value) => {
              if (value === false) {
                resolve(false);
                $("#option-description-wrapper").text(
                  "You have to declare a DataFrame variable containing the table's data."
                );
                /* Add button to select a DataFrame */
                $("#helper-buttons-wrapper").empty().append(helperBtnDf);
                // Add event functions
                $("#text-import-df")
                  .on("focus", function () {
                    Jupyter.keyboard_manager.disable();
                  })
                  .on("focusout", function () {
                    Jupyter.keyboard_manager.enable();
                  });
                $("#btn-import-df").on("click", function () {
                  const tableFile = $("#select-import-df").val();
                  const tableOp = tableFile.endsWith("csv")
                    ? "pd.read_csv"
                    : "pd.read_excel";
                  const tableName = $("#text-import-df").val();
                  insertCodeToNotebook(`
${tableName} = ${tableOp}('./${tableFile}')
${tableName}`);
                });
              } else {
                $("#option-description-wrapper").text(
                  "Here you'll see a description of what the operation you selected can accomplish when executed.\
              Remember that you have to first create and show a DataFrame to use these operations on your data."
                );
                $("#helper-buttons-wrapper").empty();
                resolve(true);
              }
            });
          }
        });
      });
    };

    const eventListenerFun = (timeOut, logMsg) => {
      console.log(logMsg);
      onEventCheckPandasAndDf().then((result) => {
        if (result === false) {
          $("#btn-insert-op").css("display", "none");
        } else {
          const op = $("#input-selector").val();
          if (op && op !== undefined) {
            const category = checkCategory();
            if (timeOut && timeOut === true) {
              setTimeout(() => {
                oplib.append_parameters(op, category);
                $("#btn-insert-op").css("display", "block");
              }, 600);
            } else {
              oplib.append_parameters(op, category);
              $("#btn-insert-op").css("display", "block");
            }
          }
        }
      });
    };

    var managetable_main = function (cfg, st) {
      const append_options = () => {
        var select_element = $("#input-selector");
        const operations = oplib.get_operations();
        operations.forEach((op) => {
          select_element.append(
            $(`<option value=${op.id}>${op.title}</option>`).addClass(
              "select-op-opt"
            )
          );
        });
      };

      const appendCategoryOptions = (category) => {
        const select_element = $("#input-selector");
        select_element
          .empty()
          .append(
            $(`<option>Select a ${category} operation</option>`)
              .addClass("select-op-opt")
              .attr("disabled", true)
              .attr("selected", true)
          );
        const operations = oplib.get_operations(category);
        operations.forEach((op) => {
          select_element.append(
            $(`<option value=${op.id}>${op.title}</option>`).addClass(
              "select-op-opt"
            )
          );
        });
      };

      // In a live notebook, read_config will have been called already, but
      // in non-live notebooks, ensure that all config values are defined.
      if (!liveNotebook) {
        cfg = $.extend(true, {}, default_cfg, cfg);
      }

      var manager_wrapper = $("#manager-wrapper");
      if (manager_wrapper.length === 0) {
        // manager_wrapper window doesn't exist at all
        create_manager_div(cfg, st); // create it
      }

      // update sidebar/window title
      $("#manager-header > .header").text(cfg.title_sidebar + " ");

      const categoryChange = (el, category) => {
        if (el.hasClass("active-btn")) {
          el.removeClass("active-btn");
          $("#input-selector")
            .empty()
            .append(
              $("<option>No category selected</option>")
                .addClass("select-op-opt")
                .attr("disabled", true)
                .attr("selected", true)
            );
          $("#input-parameters-wrapper").empty();
          $("#btn-insert-op").css("display", "none");
          $("#option-description-wrapper").text(
            "Here you'll see a description of what the operation you selected can accomplish when executed.\
            Remember that you have to first create and show a DataFrame to use these operations on your data."
          );
        } else {
          $("button.active-btn").removeClass("active-btn");
          $("#input-parameters-wrapper").empty();
          el.addClass("active-btn");
          appendCategoryOptions(category);
        }
      };

      const checkCategory = () => {
        const catText = $("button.active-btn").text();
        switch (catText) {
          case "General and table-wise operations":
            return "general";
          case "Column operations":
            return "columns";
          case "Row operations":
            return "rows";
          default:
            return "";
        }
      };

      var input_wrapper = $("<div/>")
        .addClass("input-wrapper")
        /* NEW - category buttons */
        .append(
          $("<div/>")
            .attr("id", "input-wrapper-categories")
            .append(
              $("<button />")
                .attr("id", "general-op-btn")
                .addClass("category-btn")
                .text("General and table-wise operations")
                .on("click", function () {
                  console.log("Clicked");
                  categoryChange($(this), "general");
                })
            )
            .append(
              $("<button />")
                .attr("id", "column-op-btn")
                .addClass("category-btn")
                .text("Column operations")
                .on("click", function () {
                  categoryChange($(this), "columns");
                })
            )
            .append(
              $("<button />")
                .attr("id", "row-op-btn")
                .addClass("category-btn")
                .text("Row operations")
                .on("click", function () {
                  categoryChange($(this), "rows");
                })
            )
        )
        .append(
          $("<select />")
            .attr("id", "input-selector")
            .addClass("select-op")
            .on("change", function () {
              onEventCheckPandasAndDf().then((result) => {
                if (result === false) {
                  $("#btn-insert-op").css("display", "none");
                } else {
                  $("#btn-insert-op").css("display", "block");
                  const new_op = $(this).val();
                  const category = checkCategory();
                  oplib.append_parameters(new_op, category);
                }
              });
            })
            .append(
              $("<option>No category selected</option>")
                .addClass("select-op-opt")
                .attr("disabled", true)
                .attr("selected", true)
            )
        )
        .append($("<div/>").attr("id", "input-parameters-wrapper"))
        .append(
          $("<button>Execute </button>")
            .attr("id", "btn-insert-op")
            .addClass("btn-insert-op")
            .append($("<i/>").addClass("fa fa-fw fa-arrow-right"))
        )
        .append(
          $("<div />")
            .attr("id", "option-description-wrapper")
            .text(
              "Here you'll see a description of what the operation you selected can accomplish when executed.\
              Remember that you have to first create and show a DataFrame to use these operations on your data."
            )
        )
        /* Here will appear the buttons to automatically import pandas, numpy and create a DataFrame. */
        .append($("<div />").attr("id", "helper-buttons-wrapper"));
      // update toc element
      $("#manager").empty().append(input_wrapper);

      // Append options
      // append_options();

      // Add on click method
      $("#btn-insert-op").on("click", function () {
        // Event check
        onEventCheckPandasAndDf().then((result) => {
          if (result === false) {
            $("#btn-insert-op").css("display", "none");
          } else {
            const select_value = $("#input-selector").val();
            const category = checkCategory();
            oplib.insert_python_code(select_value, category);
            // Update values after timeout
            // NOTE should append parameters only on certain operations.
            // Example: the "rename columns" op must not be appended twice.
            setTimeout(() => {
              oplib.append_parameters(select_value, category);
            }, 600);
          }
        });
      });

      /* events.off(
        "delete.Cell",
        eventListenerFun(false, "---Triggered delete cell ---")
      );  */
      /* events.on(
        "delete.Cell",
        eventListenerFun(false, "---Triggered delete cell ---")
      ); */

      /* events.off(
        "select.Cell",
        eventListenerFun(false, "---Triggered select cell ---")
      ); */
      /* events.on("select.Cell", function () {
        eventListenerFun(false, "---Triggered select cell ---");
      }); */

      /* events.off(
        "kernel_ready.Kernel",
        eventListenerFun(true, "---Triggered kernel ready cell ---")
      ); */
      /* events.on(
        "kernel_ready.Kernel",
        eventListenerFun(true, "---Triggered kernel ready cell ---")
      ); */
    };

    var toggle_manager = function (cfg, st) {
      // toggle draw (first because of first-click behavior)
      var wrap = $("#manager-wrapper");
      var show = wrap.is(":hidden");
      wrap.toggle(show);
      cfg["manager_window_display"] = setMd("manager_window_display", show);
      setNotebookWidth(cfg);
      managetable_main(cfg);
      $("#manager_button").toggleClass("active", show);
    };

    return {
      managetable_main: managetable_main,
      toggle_manager: toggle_manager,
      read_config: read_config,
    };
  }
);

if (!requirejs.specified("base/js/namespace")) {
  window.managetable_main = function (cfg, st) {
    "use strict";
    // use require to ensure the module is correctly loaded before the
    // actual call is made
    requirejs(["nbextensions/managetable/managetable"], function (managetable) {
      managetable.managetable_main(cfg, st);
    });
  };
}
