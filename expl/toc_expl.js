/* La funzione che si occupa di creare la sidebar è create_toc_div. */

var create_toc_div = function (cfg, st) {
  /* Funzione per il page resize (?) */
  var callbackPageResize = function (evt) {
    setNotebookWidth(cfg);
  };

  /* Variabile jQuery per la definizione del wrapper */
  var toc_wrapper = $('<div id="toc-wrapper"/>')
    .css("display", "none")
    .append(
      $('<div id="toc-header"/>')
        .append('<span class="header"/>')
        /*  Le classi utilizzate successivamente sono relative a Font Awesome, una libreria di icone.
            Ogni icona deve essere inserita usando il prefisso "fa" e poi il nome dell'icona, che
            è sempre del tipo "fa-nome-icona". "fa-fw" va ad indicare invece un'icona
            settata con fixed width.
            In realtà "hide-btn" è una classe standard (non capisco quale sia qua l'icona utilizzata).
        */
        .append(
          $('<i class="fa fa-fw hide-btn" title="Hide ToC">').on(
            "click",
            function (evt) {
              cfg.toc_section_display = setMd(
                "toc_section_display",
                !cfg.toc_section_display
              );
              makeUnmakeMinimized(cfg, true);
            }
          )
        )
        /* Icona del refresh */
        .append(
          $('<i class="fa fa-fw fa-refresh" title="Reload ToC">').on(
            "click",
            function (evt) {
              var icon = $(evt.currentTarget).addClass("fa-spin");
              table_of_contents(cfg, st);
              icon.removeClass("fa-spin");
            }
          )
        )
        /* Icona dell'ingranaggio */
        .append(
          $('<i class="fa fa-fw fa-cog" title="ToC settings"/>').on(
            "click",
            function (evt) {
              show_settings_dialog(cfg, st);
            }
          )
        )
    )
    /* La differenza tra append e prependTo è che la prima funzione inserisce alla fine,
    mentre prependTo va a inserire all'inizio. */
    .append($("<div/>").attr("id", "toc").addClass("toc"))
    .prependTo(liveNotebook ? "#site" : document.body);
};

function setNotebookWidth(cfg, st) {
  var margin = 20;
  var nb_inner = $("#notebook-container");
  var nb_wrap_w = $("#notebook").width();
  var sidebar = $("#toc-wrapper");
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

/* Funzione che viene richiamata direttamente per creare la TOC. */
var table_of_contents = function (cfg, st) {
  // Ricorda che cfg è stato passato come parametro e quindi è sempre utilizzabile.

  /* Se sto facendo il rendering voglio fermarmi altrimenti entro in un loop. */
  if (rendering_toc_cell) {
    return;
  }

  /*  In un notebook live ci sarà già stata la chiamata a "read_config" e quindi
      i dati di configurazione saranno già salvati. Se invece siamo in un notebook
      non live, dobbiamo assicurarci che tutt i valori siano ben definiti. */
  if (!liveNotebook) {
    // Ricalcolo cfg. Il primo valore "true" mi permette di fare un merge ricorsivo.
    cfg = $.extend(true, {}, default_cfg, cfg);
  }

  var toc_wrapper = $("#toc-wrapper");
  if (toc_wrapper.length === 0) {
    // Non c'è nessun wrapper
    create_toc_div(cfg, st); // Creo il wrapper
    /*  Il wrapper ora contiene l'header del toc (i diversi pulsanti) e un div
        vuoto con id "toc". */
    // La funzione di highlighting non è necessaria
    highlightTocItemOnScroll(cfg, st); // initialize highlighting on scroll
  }
  var ul = $("<ul/>").addClass("toc-item");
};
