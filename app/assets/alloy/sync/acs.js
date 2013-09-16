function S4() {
	return ((1 + Math.random()) * 65536 | 0).toString(16).substring(1);
}

function guid() {
	return S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4();
}

function InitAdapter(config) {
	Cloud = require("ti.cloud");
	Cloud.debug = !0;
	config.Cloud = Cloud;
}

function Sync(method, model, options) {
	var object_name = model.config.adapter.collection_name;

	if (object_name === "photos") {
		processACSPhotos(model, method, options);
	} else if (object_name === "users") {
		processACSUsers(model, method, options);
	}
};

/**
 * this is a separate handler for when the object being processed
 * is an ACS Photo
 */
function processACSPhotos(model, method, opts) {
	switch (method) {
		case "create":
			// include attributes into the params for ACS
			Cloud.Photos.create(model.toJSON(), function(e) {
				if (e.success) {

					// save the meta data with object
					model.meta = e.meta;

					// return the individual photo object found
					opts.success(e.photos[0]);

					// trigger fetch for UI updates
					model.trigger("fetch");
				} else {
					Ti.API.error("Photos.create " + e.message);
					opts.error(e.error && e.message || e);
				}
			});
			break;
		case "read":
			model.id && (opts.data.photo_id = model.id);

			var method = model.id ? Cloud.Photos.show : Cloud.Photos.query;

			method((opts.data || {}), function(e) {
				if (e.success) {
					model.meta = e.meta;
					if (e.photos.length === 1) {
						opts.success(e.photos[0]);
					} else {
						opts.success(e.photos);
					}
					model.trigger("fetch");
					return;
				} else {
					Ti.API.error("Cloud.Photos.query " + e.message);
					opts.error(e.error && e.message || e);
				}
			});
			break;
		case "update":
		case "delete":
			// Not currently implemented, let the user know
			alert("Not Implemented Yet");
			break;
	}
}

var _ = require("alloy/underscore")._;

module.exports.sync = Sync;

module.exports.beforeModelCreate = function(config) {
	config = config || {};
	config.data = {};
	InitAdapter(config);
	return config;
};

module.exports.afterModelCreate = function(Model) {
	Model = Model || {};
	Model.prototype.config.Model = Model;
	return Model;
};
