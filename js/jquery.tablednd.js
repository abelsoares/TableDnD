/**
 * TableDnD plug-in for JQuery, allows you to drag and drop table rows
 * You can set up various options to control how the system will work
 * Copyright (c) Denis Howlett <denish@isocra.com>
 * Licensed like jQuery, see http://docs.jquery.com/License.
 *
 * Configuration options:
 *
 * onDragStyle
 *     This is the style that is assigned to the row during drag. There are limitations to the styles that can be
 *     associated with a row (such as you can't assign a border--well you can, but it won't be
 *     displayed). (So instead consider using onDragClass.) The CSS style to apply is specified as
 *     a map (as used in the jQuery css(...) function).
 * onDropStyle
 *     This is the style that is assigned to the row when it is dropped. As for onDragStyle, there are limitations
 *     to what you can do. Also this replaces the original style, so again consider using onDragClass which
 *     is simply added and then removed on drop.
 * onDragClass
 *     This class is added for the duration of the drag and then removed when the row is dropped. It is more
 *     flexible than using onDragStyle since it can be inherited by the row cells and other content. The default
 *     is class is tDnD_whileDrag. So to use the default, simply customise this CSS class in your
 *     stylesheet.
 * onDrop
 *     Pass a function that will be called when the row is dropped. The function takes 2 parameters: the table
 *     and the row that was dropped. You can work out the new order of the rows by using
 *     table.rows.
 * onDragStart
 *     Pass a function that will be called when the user starts dragging. The function takes 2 parameters: the
 *     table and the row which the user has started to drag.
 * onAllowDrop
 *     Pass a function that will be called as a row is over another row. If the function returns true, allow
 *     dropping on that row, otherwise not. The function takes 2 parameters: the dragged row and the row under
 *     the cursor. It returns a boolean: true allows the drop, false doesn't allow it.
 * scrollAmount
 *     This is the number of pixels to scroll if the user moves the mouse cursor to the top or bottom of the
 *     window. The page should automatically scroll up or down as appropriate (tested in IE6, IE7, Safari, FF2,
 *     FF3 beta
 * dragHandle
 *     This is a jQuery mach string for one or more cells in each row that is draggable. If you
 *     specify this, then you are responsible for setting cursor: move in the CSS and only these cells
 *     will have the drag behaviour. If you do not specify a dragHandle, then you get the old behaviour where
 *     the whole row is draggable.
 *
 * Other ways to control behaviour:
 *
 * Add class="nodrop" to any rows for which you don't want to allow dropping, and class="nodrag" to any rows
 * that you don't want to be draggable.
 *
 * Inside the onDrop method you can also call $.tableDnD.serialize() this returns a string of the form
 * <tableID>[]=<rowID1>&<tableID>[]=<rowID2> so that you can send this back to the server. The table must have
 * an ID as must all the rows.
 *
 * Other methods:
 *
 * $("...").tableDnDUpdate()
 * Will update all the matching tables, that is it will reapply the mousedown method to the rows (or handle cells).
 * This is useful if you have updated the table rows using Ajax and you want to make the table draggable again.
 * The table maintains the original configuration (so you don't have to specify it again).
 *
 * $("...").tableDnDSerialize()
 * Will serialize and return the serialized string as above, but for each of the matching tables--so it can be
 * called from anywhere and isn't dependent on the currentTable being set up correctly before calling
 *
 * Known problems:
 * - Auto-scoll has some problems with IE7  (it scrolls even when it shouldn't), work-around: set scrollAmount to 0
 *
 * Version 0.2: 2008-02-20 First public version
 * Version 0.3: 2008-02-07 Added onDragStart option
 *                         Made the scroll amount configurable (default is 5 as before)
 * Version 0.4: 2008-03-15 Changed the noDrag/noDrop attributes to nodrag/nodrop classes
 *                         Added onAllowDrop to control dropping
 *                         Fixed a bug which meant that you couldn't set the scroll amount in both directions
 *                         Added serialize method
 * Version 0.5: 2008-05-16 Changed so that if you specify a dragHandle class it doesn't make the whole row
 *                         draggable
 *                         Improved the serialize method to use a default (and settable) regular expression.
 *                         Added tableDnDupate() and tableDnDSerialize() to be called when you are outside the table
 * Version 0.6: 2011-12-02 Added support for touch devices
 * Version 0.7  2012-04-09 Now works with jQuery 1.7 and supports touch, tidied up tabs and spaces
 */
!function ($) {
// Determine if this is a touch device
var hasTouch = 'ontouchstart' in document.documentElement,
        startEvent = hasTouch ? 'touchstart' : 'mousedown',
        moveEvent = hasTouch ? 'touchmove' : 'mousemove',
        endEvent = hasTouch ? 'touchend' : 'mouseup';

// If we're on a touch device, then wire up the events
// see http://stackoverflow.com/a/8456194/1316086
if (hasTouch) {
    $.each("touchstart touchmove touchend".split(" "), function(i, name) {
        jQuery.event.fixHooks[name] = jQuery.event.mouseHooks;
    });
}

window.jQuery.tableDnD = {
    /** Keep hold of the current table being dragged */
    currentTable : null,
    /** Keep hold of the current drag object if any */
    dragObject: null,
    /** The current mouse offset */
    mouseOffset: null,
    /** Remember the old value of X and Y so that we don't do too much processing */
    oldX: 0,
    oldY: 0,

    /** Actually build the structure */
    build: function(options) {
        // Set up the defaults if any

        this.each(function() {
            // This is bound to each matching table, set up the defaults and override with user options
            this.tableDnDConfig = jQuery.extend({
                onDragStyle: null,
                onDropStyle: null,
                // Add in the default class for whileDragging
                onDragClass: "tDnD_whileDrag",
                onDrop: null,
                onDragStart: null,
                scrollAmount: 5,
                /** Sensitivity setting will throttle the trigger rate for movement detection */
                sensitivity: 10,
                /** Hierarchy level to support parent child. 0 switches this functionality off */
                hierarchyLevel: 0,
                /** Automatic clean-up to ensure relationship integrity */
                autoCleanRelations: true,
                /** Specify a number (4) as number of spaces or any indent string for JSON.stringify */
                jsonPretifySeparator: '\t\t\t',

                serializeRegexp: /[^\-]*$/, // The regular expression to use to trim row IDs
                serializeParamName: false, // If you want to specify another parameter name instead of the table ID
                dragHandle: null // If you give the name of a class here, then only Cells with this class will be draggable
            }, options || {});

            // Now make the rows draggable
            jQuery.tableDnD.makeDraggable(this);
        });

        // Don't break the chain
        return this;
    },

    /** This function makes all the rows on the table draggable apart from those marked as "NoDrag" */
    makeDraggable: function(table) {

        var config = table.tableDnDConfig;
        if (config.dragHandle) {
            // We only need to add the event to the specified cells
            var cells = jQuery(table.tableDnDConfig.dragHandle, table);
            cells.each(function() {
                // The cell is bound to "this"
                jQuery(this).bind(startEvent, function(ev) {
                    jQuery.tableDnD.initialiseDrag(jQuery(this).parents('tr')[0], table, this, ev, config);
                    return false;
                });
            })
        } else {
            // For backwards compatibility, we add the event to the whole row
            var rows = jQuery("tr", table); // get all the rows as a wrapped set
            rows.each(function() {
                // Iterate through each row, the row is bound to "this"
                var row = jQuery(this);
                if (! row.hasClass("nodrag")) {
                    row.bind(startEvent, function(ev) {
                        if (ev.target.tagName == "TD") {
                            jQuery.tableDnD.initialiseDrag(this, table, this, ev, config);
                            return false;
                        }
                    }).css("cursor", "move"); // Store the tableDnD object
                }
            });
        }
    },
    hashItChanged: function(value) {
        var rows = jQuery.tableDnD.currentTable.rows;
        return $.map(rows, function (val) {
            return $.map(($(val).find('div.indent').length+val.id).split(''), function (v) {
                return v.charCodeAt(0).toString(16).toUpperCase();
            }).join('');
        }).join('');
    },
    initialiseDrag: function(dragObject, table, target, evnt, config) {
        jQuery.tableDnD.dragObject = dragObject;
        jQuery.tableDnD.currentTable = table;
        jQuery.tableDnD.mouseOffset = jQuery.tableDnD.getMouseOffset(target, evnt);
        jQuery.tableDnD.originalOrder =  jQuery.tableDnD.hashItChanged();

        // Now we need to capture the mouse up and mouse move event
        // We can use bind so that we don't interfere with other event handlers
        jQuery(document)
                .bind(moveEvent, jQuery.tableDnD.mousemove)
                .bind(endEvent, jQuery.tableDnD.mouseup);
        if (config.onDragStart) {
            // Call the onDragStart method if there is one
            config.onDragStart(table, target);
        }
    },

    updateTables: function() {
        this.each(function() {
            // this is now bound to each matching table
            if (this.tableDnDConfig) {
                jQuery.tableDnD.makeDraggable(this);
            }
        })
    },

    /** Get the mouse coordinates from the event (allowing for browser differences) */
    mouseCoords: function(ev){
        if(ev.pageX || ev.pageY){
            return {x:ev.pageX, y:ev.pageY};
        }
        return {
            x:ev.clientX + document.body.scrollLeft - document.body.clientLeft,
            y:ev.clientY + document.body.scrollTop  - document.body.clientTop
        };
    },

    /** Given a target element and a mouse event, get the mouse offset from that element.
     To do this we need the element's position and the mouse position */
    getMouseOffset: function(target, ev) {
        ev = ev || window.event;

        var docPos    = this.getPosition(target);
        var mousePos  = this.mouseCoords(ev);
        return {x:mousePos.x - docPos.x, y:mousePos.y - docPos.y};
    },

    /** Get the position of an element by going up the DOM tree and adding up all the offsets */
    getPosition: function(e){
        var left = 0;
        var top  = 0;
        /** Safari fix -- thanks to Luis Chato for this! */
        if (e.offsetHeight == 0) {
            /** Safari 2 doesn't correctly grab the offsetTop of a table row
             this is detailed here:
             http://jacob.peargrove.com/blog/2006/technical/table-row-offsettop-bug-in-safari/
             the solution is likewise noted there, grab the offset of a table cell in the row - the firstChild.
             note that firefox will return a text node as a first child, so designing a more thorough
             solution may need to take that into account, for now this seems to work in firefox, safari, ie */
            e = e.firstChild; // a table cell
        }

        while (e.offsetParent){
            left += e.offsetLeft;
            top  += e.offsetTop;
            e     = e.offsetParent;
        }

        left += e.offsetLeft;
        top  += e.offsetTop;

        return {x:left, y:top};
    },

    mousemove: function(ev) {
        ev.preventDefault();
        if (jQuery.tableDnD.dragObject == null) {
            return;
        }
        if (ev.type == 'touchmove') {
            // prevent touch device screen scrolling
            event.preventDefault();
        }

        var dragObj = jQuery(jQuery.tableDnD.dragObject);
        var config = jQuery.tableDnD.currentTable.tableDnDConfig;
        var mousePos = jQuery.tableDnD.mouseCoords(ev);
        var x = mousePos.x - jQuery.tableDnD.mouseOffset.x;
        var y = mousePos.y - jQuery.tableDnD.mouseOffset.y;
        //auto scroll the window
        var yOffset = window.pageYOffset;
        if (document.all) {
            // Windows version
            //yOffset=document.body.scrollTop;
            if (typeof document.compatMode != 'undefined' &&
                    document.compatMode != 'BackCompat') {
                yOffset = document.documentElement.scrollTop;
            }
            else if (typeof document.body != 'undefined') {
                yOffset=document.body.scrollTop;
            }
        }

        if (mousePos.y-yOffset < config.scrollAmount) {
            window.scrollBy(0, -config.scrollAmount);
        } else {
            var windowHeight = window.innerHeight ? window.innerHeight
                    : document.documentElement.clientHeight ? document.documentElement.clientHeight : document.body.clientHeight;
            if (windowHeight-(mousePos.y-yOffset) < config.scrollAmount) {
                window.scrollBy(0, config.scrollAmount);
            }
        }

        // update the style to show we're dragging
        if (config.onDragClass) {
            dragObj.addClass(config.onDragClass);
        } else {
            dragObj.css(config.onDragStyle);
        }
        var currentRow = jQuery.tableDnD.findDropTargetRow(dragObj, y);

        var moving = jQuery.tableDnD.findDragDirection(x, y);
        if (0 != moving.vertical) {
            // If we're over a row then move the dragged row to there so that the user sees the
            // effect dynamically
            if (currentRow && jQuery.tableDnD.dragObject != currentRow
                && jQuery.tableDnD.dragObject.parentNode == currentRow.parentNode) {
                if (0 > moving.vertical) {
                    jQuery.tableDnD.dragObject.parentNode.insertBefore(jQuery.tableDnD.dragObject, currentRow.nextSibling);
                } else if (0 < moving.vertical) {
                    jQuery.tableDnD.dragObject.parentNode.insertBefore(jQuery.tableDnD.dragObject, currentRow);
                }
            }
        }
        if (config.hierarchyLevel && 0 != moving.horizontal) {
            // We only care if moving left or right on the current row
            if (currentRow && jQuery.tableDnD.dragObject == currentRow) {
                var currentLevel = $(currentRow).find('div.indent').length;
                if (0 < moving.horizontal && currentLevel > 0) {
                    $(currentRow).find('div.indent').first().remove();
                } else if (0 > moving.horizontal && currentLevel < config.hierarchyLevel) {
                    if ($(currentRow).prev().find('div.indent').length >= currentLevel) {
                        $(currentRow).children(':first').prepend('<div class="indent">&nbsp;</div>');
                    }
                }
            }
        }
        return false;
    },

    findDragDirection: function (x,y) {
        xMin = jQuery.tableDnD.oldX - jQuery.tableDnD.currentTable.tableDnDConfig.sensitivity;
        xMax = jQuery.tableDnD.oldX + jQuery.tableDnD.currentTable.tableDnDConfig.sensitivity;
        yMin = jQuery.tableDnD.oldY - jQuery.tableDnD.currentTable.tableDnDConfig.sensitivity;
        yMax = jQuery.tableDnD.oldY + jQuery.tableDnD.currentTable.tableDnDConfig.sensitivity;
        var moving = {
            horizontal: x >= xMin && x <= xMax ? 0 : x > jQuery.tableDnD.oldX ? -1 : 1,
            vertical  : y >= yMin && y <= yMax ? 0 : y > jQuery.tableDnD.oldY ? -1 : 1
        };
        // update the old value
        if (moving.horizontal != 0)
            jQuery.tableDnD.oldX = x;
        if (moving.vertical != 0)
            jQuery.tableDnD.oldY = y;

        return moving;
    },

    /** We're only worried about the y position really, because we can only move rows up and down */
    findDropTargetRow: function(draggedRow, y) {
        var rows = jQuery.tableDnD.currentTable.rows;
        for (var i=0; i<rows.length; i++) {
            var row = rows[i];
            var rowY    = this.getPosition(row).y;
            var rowHeight = parseInt(row.offsetHeight)/2;
            if (row.offsetHeight == 0) {
                rowY = this.getPosition(row.firstChild).y;
                rowHeight = parseInt(row.firstChild.offsetHeight)/2;
            }
            // Because we always have to insert before, we need to offset the height a bit
            if ((y > rowY - rowHeight) && (y < (rowY + rowHeight))) {
                // that's the row we're over
                // If it's the same as the current row, ignore it
                if (row == draggedRow) {return null;}
                var config = jQuery.tableDnD.currentTable.tableDnDConfig;
                if (config.onAllowDrop) {
                    if (config.onAllowDrop(draggedRow, row)) {
                        return row;
                    } else {
                        return null;
                    }
                } else {
                    // If a row has nodrop class, then don't allow dropping (inspired by John Tarr and Famic)
                    var nodrop = jQuery(row).hasClass("nodrop");
                    if (! nodrop) {
                        return row;
                    } else {
                        return null;
                    }
                }
                return row;
            }
        }
        return null;
    },

    mouseup: function(e) {
        e.preventDefault();
        if (jQuery.tableDnD.currentTable && jQuery.tableDnD.dragObject) {
            // Unbind the event handlers
            jQuery(document)
                    .unbind(moveEvent, jQuery.tableDnD.mousemove)
                    .unbind(endEvent, jQuery.tableDnD.mouseup);
            var droppedRow = jQuery.tableDnD.dragObject;
            var config = jQuery.tableDnD.currentTable.tableDnDConfig;
            if (config.hierarchyLevel && config.autoCleanRelations) {
                $(jQuery.tableDnD.currentTable.rows).first().find('div.indent').each(function () {
                    $(this).remove();
                });
                if (config.hierarchyLevel > 1) {
                    $(jQuery.tableDnD.currentTable.rows).each(function () {
                        var myLevel = $(this).find('div.indent').length;
                        if (myLevel > 1) {
                            var parentLevel = $(this).prev().find('div.indent').length;
                            while (myLevel > parentLevel + 1) {
                               $(this).find('div.indent:first').remove();
                               myLevel = $(this).find('div.indent').length;
                            }
                        }
                    });
                }
            }
            // If we have a dragObject, then we need to release it,
            // The row will already have been moved to the right place so we just reset stuff
            if (config.onDragClass) {
                jQuery(droppedRow).removeClass(config.onDragClass);
            } else {
                jQuery(droppedRow).css(config.onDropStyle);
            }
            jQuery.tableDnD.dragObject = null;

            if (config.onDrop && $.tableDnD.originalOrder != $.tableDnD.hashItChanged()) {
                // Call the onDrop method if there is one
                config.onDrop(jQuery.tableDnD.currentTable, droppedRow);
            }
            jQuery.tableDnD.currentTable = null; // let go of the table too
        }
    },
    jsonize: function(pretify) {
        table = $.tableDnD.currentTable;
        if (pretify)
            return JSON.stringify(
                $.tableDnD.tableData(table),
                null,
                table.tableDnDConfig.jsonPretifySeparator
            );
        return JSON.stringify($.tableDnD.tableData(table));
    },
    serialize: function() {
        return $.param($.tableDnD.tableData($.tableDnD.currentTable));
    },
    serializeTable: function(table) {
        var result = "";
        var paramName = table.tableDnDConfig.serializeParamName || table.id;
        var rows = table.rows;
        for (var i=0; i<rows.length; i++) {
            if (result.length > 0) result += "&";
            var rowId = rows[i].id;
            if (rowId && table.tableDnDConfig && table.tableDnDConfig.serializeRegexp) {
                rowId = rowId.match(table.tableDnDConfig.serializeRegexp)[0];
                result += tableId + '[]=' + rowId;
            }
        }
        return result;
    },
    serializeTables: function() {
        var result = [];
        $('table').each(function() {
            if (this.id)
                result.push($.param($.tableDnD.tableData(this)));
        });
        return result.join('&');
    },
    tableData: function (table) {
        if (!table)
            table = $.tableDnD.currentTable;
        if (!table||!table.id)
            return {error: { code: 500, message: "Not a volid table, no serializable unique id provided."}};

        var rows         = table.rows,
            paramName    = table.tableDnDConfig.serializeParamName || table.id,
            currentID    = paramName,
            previousIDs  = [],
            currentLevel = 0,
            rowID        = null,
            data         = {};

        var getSerializeRegexp = function (rowId) {
            if (rowId && table.tableDnDConfig && table.tableDnDConfig.serializeRegexp)
                return rowId.match(table.tableDnDConfig.serializeRegexp)[0];
            return rowId;
        };

        data[currentID] = [];

        for (var i=0; i < rows.length; i++) {
            if (table.tableDnDConfig.hierarchyLevel) {
                var indentLevel = $(rows[i]).children(':first').find('div.indent').length;
                if (indentLevel == 0) {
                    currentID   = paramName;
                    previousIDs = [];
                }
                else if (indentLevel > currentLevel) {
                    previousIDs.push([currentID, currentLevel]);
                    currentID = getSerializeRegexp(rows[i-1].id);
                }
                else if (indentLevel < currentLevel) {
                    for (var h = 0; h < previousIDs.length; h++) {
                        if (previousIDs[h][1] == indentLevel)
                            currentID        = previousIDs[h][0];
                        if (previousIDs[h][1] >= currentLevel)
                            previousIDs[h][1] = 0;
                    }
                }
                currentLevel = indentLevel;

                if (!$.isArray(data[currentID]))
                    data[currentID] = [];
                rowID = getSerializeRegexp(rows[i].id);
                if (rowID)
                    data[currentID].push(rowID);
            }
            else {
                rowID = getSerializeRegexp(rows[i].id);
                if (rowID) {
                    data[currentID].push(rowID);
                    currentID = rowID;
                }
            }
        }
        return data;
    }
};

window.jQuery.fn.extend(
    {
        tableDnD             : jQuery.tableDnD.build,
        tableDnDUpdate       : jQuery.tableDnD.updateTables,
        tableDnDSerialize    : jQuery.tableDnD.serialize,
        tableDnDSerializeAll : jQuery.tableDnD.serializeTables,
        tableDnDData         : jQuery.tableDnD.tableData
    }
);

}(window.jQuery);
