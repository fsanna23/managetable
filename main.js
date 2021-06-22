define([
  "require",
  "jquery",
  "base/js/namespace",
  "base/js/events",
  "notebook/js/codecell",
  "nbextensions/managetable/managetable",
], function (requirejs, $, Jupyter, events, codecell, managetable) {
  "use strict";

  // imports
  var managetable_main = managetable.managetable_main;
  var toggle_manager = managetable.toggle_manager;
  var IPython = Jupyter;

  // Display manager button
  var manager_button = function (cfg) {
    if (!IPython.toolbar) {
      events.on("app_initialized.NotebookApp", function (evt) {
        manager_button(cfg);
      });
      return;
    }
    if ($("#manager_button").length === 0) {
      $(
        IPython.toolbar.add_buttons_group([
          Jupyter.keyboard_manager.actions.register(
            {
              help: "Manage Table",
              icon: "fa-list",
              handler: function () {
                toggle_manager(cfg);
              },
            },
            "toggle-manager",
            "managetable"
          ),
        ])
      )
        .find(".btn")
        .attr("id", "manager_button");
    }
  };

  var load_css = function () {
    var link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = requirejs.toUrl("./main.css");
    document.getElementsByTagName("head")[0].appendChild(link);
    link = document.createElement("link");
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = requirejs.toUrl("./chosen.css");
    document.getElementsByTagName("head")[0].appendChild(link);
    $("head").append(
      '<link rel="preconnect" href="https://fonts.gstatic.com">'
    );
    $("head").append(
      '<link href="https://fonts.googleapis.com/css2?family=Roboto&display=swap" rel="stylesheet">'
    );
    $("head").append(
      '<link href="https://fonts.googleapis.com/css2?family=Open+Sans&display=swap" rel="stylesheet">'
    );
  };

  function create_additional_css(cfg) {
    var sheet = document.createElement("style");
    if (cfg.moveMenuLeft) {
      sheet.innerHTML +=
        "div#menubar-container, div#header-container {\n" +
        "width: auto;\n" +
        "padding-left: 20px; }";
    }
    // Using custom colors
    sheet.innerHTML +=
      "#manager-wrapper { background-color: " +
      cfg.colors.wrapper_background +
      "}\n";
    sheet.innerHTML +=
      ".sidebar-wrapper { border-color: " + cfg.colors.sidebar_border + "}";
    document.body.appendChild(sheet);
  }

  var managetable_init = function () {
    // read configuration, then call toc
    IPython.notebook.config.loaded.then(function () {
      var cfg = managetable.read_config();
      // create highlights style section in document
      create_additional_css(cfg);
      // add toc toggle button (now that cfg has loaded)
      manager_button(cfg);
      // call main function with newly loaded config (proviene dal secondo file)
      // managetable_main(cfg);
      toggle_manager(cfg);
    });
  };

  // This has to be the same name
  var load_ipython_extension = function () {
    load_css();

    // Wait for the notebook to be fully loaded
    if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
      // this tests if the notebook is fully loaded
      console.log(
        "[managetable] Notebook fully loaded -- managetable initialized "
      );
      managetable_init();
    } else {
      console.log("[managetable] Waiting for notebook availability");
      events.on("notebook_loaded.Notebook", function () {
        console.log(
          "[managetable]managetable initialized (via notebook_loaded)"
        );
        managetable_init();
      });
    }
  };

  // Final return
  return {
    load_ipython_extension: load_ipython_extension,
    toggle_manager: toggle_manager,
    managetable_main: managetable_main,
  };
});
