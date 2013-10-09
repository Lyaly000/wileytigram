// we get the progress indicator from here
var sharing = require('sharing');

// EVENT LISTENERS
// on android, we need the change event not the click event
$.filter.addEventListener(Ti.Android ? 'change' : 'click', filterClicked);

$.friendsWindow.addEventListener("close", closeWindowEventHandler);
$.friendsWindow.addEventListener("androidback", androidBackEventHandler);

function getAllUsersExceptFriends() {

	// which template to user when rendering listView
	$.collectionType = "fullItem";

	sharing.showIndicator("Loading Users...");

	// remove all items from the collection
	$.friendUserCollection.reset();

	// set up where parameters using the $.friendsIdList
	// from the updateFollowersFriendsLists function call
	var where_params = {
		"_id" : {
			"$nin" : $.friendsIdList, // means NOT IN
		},
	};
	// set the where params on the query
	$.friendUserCollection.fetch({
		data : {
			per_page : 100,
			order : '-last_name',
			where : JSON.stringify(where_params),
		},
		success : function() {
			// user collection is updated into
			// $.friendUserCollection variable
			sharing.hideIndicator();
		},
		error : function() {
			sharing.hideIndicator();
			alert("Error Loading Users");
		}
	});
}

function getModelFromSelectedRow(_event) {
	var item = _event.section.items[_event.itemIndex];
	var selectedUserId = item.properties.modelId;
	return {
		model : $.friendUserCollection.get(selectedUserId),
		displayName : item.userName.text,
	};
}

function followBtnClicked(_event) {

	sharing.showIndicator("Updating User");

	var currentUser = Alloy.Globals.currentUser;
	var selUser = getModelFromSelectedRow(_event);

	currentUser.followUser(selUser.model.id, function(_resp) {
		if (_resp.success) {
			alert("You are now following " + selUser.displayName);
		} else {
			alert("Error trying to follow " + selUser.displayName);
		}
		sharing.hideIndicator();

		// update the lists IF it was successful
		_resp.success && updateFollowersFriendsLists(function() {

			// update the UI to reflect the change
			getAllUsersExceptFriends();

			sharing.hideIndicator();
		});

	});

	_event.cancelBubble = true;
};

function followingBtnClicked(_event) {

	sharing.showIndicator("Updating User");

	var currentUser = Alloy.Globals.currentUser;
	var selUser = getModelFromSelectedRow(_event);

	currentUser.unFollowUser(selUser.model.id, function(_resp) {
		if (_resp.success) {
			alert("You are not following " + selUser.displayName);
		} else {
			alert("Error unfollowing " + selUser.displayName);
		}
		sharing.hideIndicator();

		// update the lists
		_resp.success && updateFollowersFriendsLists(function() {

			// update the UI to reflect the change
			loadFriends();

			sharing.hideIndicator();
		});
	});
	_event.cancelBubble = true;
};

function filterClicked(_event) {
	var itemSelected;
	itemSelected = !Ti.Android ? _event.index : _event.rowIndex;

	// clear the ListView display
	$.section.deleteItemsAt(0, $.section.items.length);

	// call the appropriate function to update the display
	switch (itemSelected) {
		case 0 :
			getAllUsersExceptFriends();
			break;
		case 1 :
			loadFriends();
			break;
		case 2 :
			loadFollowers();
			break;
	}
}

function loadFriends(_callback) {
	var user = Alloy.Globals.currentUser;

	sharing.showIndicator("Loading Friends...");

	user.getFriends(function(_resp) {
		if (_resp.success) {
			if (_resp.collection.models.length === 0) {
				$.friendUserCollection.reset();
				sharing.hideIndicator();
				return;
			}
			$.collectionType = "friends";

			$.friendUserCollection.reset(_resp.collection.models);
			$.friendUserCollection.trigger("sync");

			sharing.hideIndicator();
		} else {
			alert("Error loading followers");
			sharing.hideIndicator();
		}
	});
};

function doTransform(model) {

	var displayName, image, user = model.toJSON();

	// get the photo
	if (user.photo && user.photo.urls) {
		image = user.photo.urls.square_75 || user.photo.urls.thumb_100 || user.photo.urls.original || "missing.gif";
	} else {
		image = "missing.gif";
	}

	// get the display name
	if (user.first_name || user.last_name) {
		displayName = (user.first_name || "") + " " + (user.last_name || "");
	} else {
		displayName = user.email;
	}

	// return the object
	var modelParams = {
		title : displayName,
		image : image,
		modelId : user.id,
		template : $.collectionType
	};

	return modelParams;
};

function doFilter(_collection) {
	return _collection.filter(function(_i) {
		var attrs = _i.attributes;
		return ((_i.id !== Alloy.Globals.currentUser.id) && (attrs.admin === "false" || !attrs.admin));
	});
};

function updateFollowersFriendsLists(_callback) {
	var currentUser = Alloy.Globals.currentUser;

	// get the followers/friends id for the current user
	currentUser.getFollowers(function(_resp) {
		if (_resp.success) {
			$.followersIdList = _.pluck(_resp.collection.models, "id");

			// get the friends
			currentUser.getFriends(function(_resp) {
				if (_resp.success) {
					$.friendsIdList = _.pluck(_resp.collection.models, "id");
				} else {
					alert("Error updating friends and followers");
				}
				_callback();
			});
		} else {
			alert("Error updating friends and followers");
			_callback();
		}

	});
}

function initialize() {
	$.filter.index = 0;

	sharing.showIndicator("Loading...");

	updateFollowersFriendsLists(function() {
		sharing.hideIndicator();

		// get the users
		$.collectionType = "fullItem";

		getAllUsersExceptFriends();

	});

};

$.getView().addEventListener("focus", function() {
	initialize();
});
