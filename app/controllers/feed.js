// load Geolocation library
var geo = require("geo");
var sharing = require("sharing");
var push = require('pushNotifications');

// EVENT LISTENERS
// there will only be a camera button on IOS
OS_IOS && $.cameraButton.addEventListener("click", function(_event) {
	$.cameraButtonClicked(_event);
});
$.feedTable.addEventListener("click", processTableClicks);
$.filter.addEventListener( OS_IOS ? 'click' : 'change', filterTabbedBarClicked);
$.mapview.addEventListener('click', mapAnnotationClicked);

// EVENT HANDLERS
/**
 * called when user clicks on the camera button. Will display the
 * device camera and allow the user to take a photo
 */
$.cameraButtonClicked = function(_event) {
	alert("user clicked camera button");

	Titanium.Media.showCamera({
		success : function(event) {

			Alloy.Globals.PW.showIndicator("Saving Image");
			var ImageFactory = require('ti.imagefactory');

			if (OS_ANDROID || event.media.width > 700) {
				var w, h;
				w = event.media.width * .50;
				h = event.media.height * .50;
				$.resizedPhoto = ImageFactory.imageAsResized(event.media, {
					width : w,
					height : h
				});
			} else {
				// we do not need to compress here
				$.resizedPhoto = event.media;
			}

			processImage($.resizedPhoto, function(_processResp) {

				if (_processResp.success) {
					// create the row
					var rowController = Alloy.createController("feedRow", _processResp.model);

					// add the controller view, which is a row to the table
					if ($.feedTable.getData().length === 0) {
						$.feedTable.setData([]);
						$.feedTable.appendRow(rowController.getView(), true);
					} else {
						$.feedTable.insertRowBefore(0, rowController.getView(), true);
					}

					//now add to the backbone collection
					var collection = Alloy.Collections.instance("Photo");
					collection.add(_processResp.model, {
						at : 0,
						silent : true
					});
				} else {
					alert("Error saving photo " + _processResp.message);
				}

				Alloy.Globals.PW.hideIndicator();
			});

		},

		cancel : function() {
			// called when user cancels taking a picture
		},
		error : function(error) {
			// display alert on error
			if (error.code == Titanium.Media.NO_CAMERA) {
				alert('Please run this test on device');
			} else {
				alert('Unexpected error: ' + error.code);
			}
		},
		saveToPhotoGallery : false,
		allowEditing : true,
		// only allow for photos, no video
		mediaTypes : [Ti.Media.MEDIA_TYPE_PHOTO]
	});
};

// PRIVATE FUNCTIONS
/**
 * this is where the image is prepped for being saved to ACS
 */
function processImage(_mediaObject, _callback) {

	geo.getCurrentLocation(function(_coords) {

		var parameters = {
			"photo" : _mediaObject,
			"title" : "Sample Photo " + new Date(),
			"photo_sizes[preview]" : "200x200#",
			"photo_sizes[iphone]" : "320x320#",
			// Since we are showing the image immediately
			"photo_sync_sizes[]" : "preview",
		};

		// if we got a location, then set it
		if (_coords) {
			parameters.custom_fields = {
				coordinates : [_coords.coords.longitude, _coords.coords.latitude],
				location_string : _coords.title
			};
		}

		var photo = Alloy.createModel('Photo', parameters);
		var currentUser = Alloy.Globals.currentUser;

		photo.save({}, {

			success : function(_model, _response) {
				Ti.API.debug('success: ' + _model.toJSON());
				currentUser.getFollowers(function(_resp) {
					if (_resp.success) {
						$.followersList = _.pluck(_resp.collection.models, "id");

						// send a push notification to all friends
						var msg = "New photo posted by " + currentUser.get("email");

						// make the api call using the library
						push.sendPush({
							payload : {
								custom : {
									photo_id : _model.get("id"),
								},
								sound : "default",
								alert : msg
							},
							to_ids : $.followersList.join(),
						}, function(_repsonsePush) {
							if (_repsonsePush.success) {
								alert("Notified friends of new photo");
							} else {
								alert("Error notifying friends of new photo");
							}
						});
					} else {
						alert("Error updating friends and followers");
						_callback();
					}
				});
				_callback({
					model : _model,
					message : null,
					success : true
				});
			},
			error : function(e) {
				Ti.API.error('error: ' + e.message);
				_callback({
					model : parameters,
					message : e.message,
					success : false
				});
			}
		});
	});
}

function loadPhotos() {
	var rows = [];

	// creates or gets the global instance of photo collection
	var photos = Alloy.Collections.photo || Alloy.Collections.instance("Photo");

	// be sure we ignore profile photos;
	var where = {
		title : {
			"$exists" : true
		}
	};

	photos.fetch({
		data : {
			order : '-created_at',
			where : where
		},
		success : function(model, response) {
			photos.each(function(photo) {
				var photoRow = Alloy.createController("feedRow", photo);
				rows.push(photoRow.getView());
			});
			$.feedTable.data = rows;
		},
		error : function(error) {
			alert('Error loading Feed ' + error.message);
			Ti.API.error(JSON.stringify(error));
		}
	});
}

function processTableClicks(_event) {

	if (_event.source.id === "commentButton") {
		handleCommentButtonClicked(_event);
	} else if (_event.source.id === "locationButton") {
		handleLocationButtonClicked(_event);
	} else if (_event.source.id === "shareButton") {
		handleShareButtonClicked(_event);
	}
}

function handleLocationButtonClicked(_event) {

	var collection = Alloy.Collections.instance("Photo");
	var model = collection.get(_event.row.row_id);

	var customFields = model.get("custom_fields");

	if (customFields && customFields.coordinates) {
		var mapController = Alloy.createController("mapView", {
			photo : model,
			parentController : $
		});

		// open the view
		Alloy.Globals.openCurrentTabWindow(mapController.getView());
	} else {
		alert("No Location was Saved with Photo");
	}
}

function handleCommentButtonClicked(_event) {

	var collection, model;

	if (!_event.row) {
		model = _event.data;
	} else {
		collection = Alloy.Collections.instance("Photo");
		model = collection.get(_event.row.row_id);
	}

	var commentController = Alloy.createController("comment", {
		photo : model,
		parentController : $
	});

	// initialize the data in the view
	commentController.initialize();

	// open the view
	Alloy.Globals.openCurrentTabWindow(commentController.getView());

}

function handleShareButtonClicked(_event) {
	var collection, model;

	if (!_event.row) {
		model = _event.data;
	} else {
		collection = Alloy.Collections.instance("Photo");
		model = collection.get(_event.row.row_id);
	}

	// commonjs library for sharing
	sharing.sharingOptions({
		model : model
	});
}

function filterTabbedBarClicked(_event) {
	var itemSelected = OS_IOS ? _event.index : _event.rowIndex;
	switch (itemSelected) {
		case 0 :
			// List View Display
			$.mapview.visible = false;
			$.feedTable.visible = true;
			break;
		case 1 :
			// Map View Display
			$.feedTable.visible = false;
			$.mapview.visible = true;
			showLocalImages();
			break;
	}
}

function showLocalImages() {
	// create new photo collection
	$.locationCollection = Alloy.createCollection('photo');

	// find all photos within 5 miles of current location
	$.locationCollection.findPhotosNearMe(Alloy.Globals.currentUser, 5, {
		success : function(_collection, _response) {
			Ti.API.info(JSON.stringify(_collection));

			// add the annotations/map pins to map
			if (_collection.models.length) {
				addPhotosToMap(_collection);
			} else {
				alert("No Local Images Found");
				filterTabbedBarClicked({
					index : 0,
					rowIndex : 0,
				});

				if (OS_ANDROID) {
					$.filter.setSelectedRow(0, 0, false);
				} else {
					$.filter.setIndex(0);
				}
			}
		},
		error : function(error) {
			alert('Error loading Feed ' + error.message);
			Ti.API.error(JSON.stringify(error));
		}
	});
}

function addPhotosToMap(_collection) {
	var annotationArray = [];
	var lastLat;

	// remove all annotations from map
	$.mapview.removeAllAnnotations();

	var annotationRightButton = function() {
		var button = Ti.UI.createButton({
			title : "X",
		});
		return button;
	};

	for (var i in _collection.models) {
		var mapData = _collection.models[i].toJSON();
		var coords = mapData.custom_fields.coordinates;
		var annotation = Alloy.Globals.Map.createAnnotation({
			latitude : Number(coords[0][1]),
			longitude : Number(coords[0][0]),
			subtitle : mapData.custom_fields.location_string,
			title : mapData.title,
			//animate : true,
			data : _collection.models[i].clone()
		});

		if (OS_IOS) {
			annotation.setPincolor(Alloy.Globals.Map.ANNOTATION_RED);
			annotation.setRightButton(Titanium.UI.iPhone.SystemButton.DISCLOSURE);
		} else {
			annotation.setRightButton(annotationRightButton);
		}
		annotationArray.push(annotation);

	}

	// calculate the map region based on the annotations
	var region = geo.calculateMapRegion(annotationArray);
	$.mapview.setRegion(region);

	// add the annotations to the map
	$.mapview.setAnnotations(annotationArray);
}

function mapAnnotationClicked(_event) {
	// get event properties
	var annotation = _event.annotation;
	//get the Myid from annotation
	var clickSource = _event.clicksource;

	// Check if 'rightButton' clicked
	if (clickSource === 'rightButton') {

		// load the mapDetail controller
		var mapDetailCtrl = Alloy.createController('mapDetail', {
			photo : annotation.data,
			parentController : $,
			clickHandler : processTableClicks
		});

		// open the view
		Alloy.Globals.openCurrentTabWindow(mapDetailCtrl.getView());

	}
};

/**
 *
 */
$.initialize = function() {
	// clear out photos
	Alloy.Collections.photo && Alloy.Collections.photo.reset();

	// load the photos
	loadPhotos();
};
