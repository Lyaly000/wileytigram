// Global Functions

/**
 * open the window using the tabGroup so we get the back button
 * functionality and all of the nav bar goodness
 *
 * @param {Object} _window
 */
Alloy.Globals.openCurrentTabWindow = function(_window) {
    $.tabGroup.activeTab.open(_window);
};

// setting the UI for Android Applications
/**
 * on the open event of the tabGroup, setup the menu and add an
 * event listener that will reset the menus when the active tab
 * changes.
 *
 * This allows each tab window to have a unique set of menus in
 * the actionBar
 */
function doOpen() {

    if (OS_ANDROID) {
        //Add a title to the tabgroup. We could also add menu items here if
        // needed
        var activity = $.getView().activity;
        var menuItem = null;

        activity.onCreateOptionsMenu = function(e) {

            Ti.API.info('IN activity.onCreateOptionsMenu');
            Ti.API.info('Active Tab: ' + $.tabGroup.activeTab.title);

            if ($.tabGroup.activeTab.title === "Feed") {

                menuItem = e.menu.add({
                    //itemId : "PHOTO",
                    title : "Take Photo",
                    showAsAction : Ti.Android.SHOW_AS_ACTION_ALWAYS,
                    icon : Ti.Android.R.drawable.ic_menu_camera
                });

                menuItem.addEventListener("click", function(e) {
                    $.feedController.cameraButtonClicked();
                });
            } else {
                // No Menu Buttons
            }
        };

        activity.invalidateOptionsMenu();
    }

}

// this forces the menu to update when the tab changes and to 
// update the friends list when the friends tab is made active
$.tabGroup.addEventListener('blur', function(_event) {
    
    // got blur event but tab did not change, just exit
    if (_event.index === _event.previousIndex) {
        return;
    }
    
    // if android, update menus
    OS_ANDROID && $.getView().activity.invalidateOptionsMenu();

    // here we can update specific tabs when they get opened
    if ( $.tabGroup.activeTab.title === "Friends") {
        $.friendsController.initialize();
    }
});

$.userLoggedInAction = function() {
    user.showMe(function(_response) {
        if (_response.success === true) {
            indexController.loginSuccessAction(_response);
        } else {
            alert("Application Error\n " + _response.error.message);
            Ti.API.error(JSON.stringify(_response.error, null, 2));

            // go ahead and do the login
            $.userNotLoggedInAction();
        }
    });
};

$.loginSuccessAction = function(_options) {

    Ti.API.info('logged in user information');
    Ti.API.info(JSON.stringify(_options.model, null, 2));

    // open the main screen
    $.tabGroup.open();

    // set tabGroup to initial tab, incase this is coming from
    // a previously logged in state
    $.tabGroup.setActiveTab(0);

    // pre-populate the feed with recent photos
    $.feedController.initialize();

    // get the current user
    Alloy.Globals.currentUser = _options.model;

    // set the parent controller for all of the tabs, give us
    // access to the global tab group and misc functionality
    $.feedController.parentController = indexController;
    $.friendsController.parentController = indexController;
    $.settingsController.parentController = indexController;

    // do any necessary cleanup in login controller
    $.loginController && $.loginController.close();
};

$.userNotLoggedInAction = function() {

    // open the login controller to login the user
    if ($.loginController === null) {
        $.loginController = Alloy.createController("login", {
            parentController : indexController,
            reset : true
        });
    }

    // open the window
    $.loginController.open(true);

};

// when we start up, create a user and log in
var user = Alloy.createModel('User');
var indexController = $;
$.loginController = null;

if (user.authenticated() === true) {
    $.userLoggedInAction();
} else {
    $.userNotLoggedInAction();
}

/*
 // we are using the default administration account for now
 user.login("wileytigram_admin", "wileytigram_admin", function(_response) {
 if (_response.success) {
 // open the main screen
 $.tabGroup.open();

 // pre-populate the feed with recent photos
 $.feedController.initialize();

 } else {
 alert("Error Starting Application " + _response.error);
 Ti.API.error('error logging in ' + _response.error);
 }
 });
 */