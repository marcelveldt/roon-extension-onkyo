"use strict";

var debug                = require('debug')('roon-extension-onkyo'),
    util                 = require('util'),
    debug_keepalive      = require('debug')('roon-extension-onkyo:keepalive'),
    eiscp                = require('eiscp'),
    RoonApi              = require('node-roon-api'),
    RoonApiSettings      = require('node-roon-api-settings'),
    RoonApiStatus        = require('node-roon-api-status'),
    RoonApiSourceControl = require("node-roon-api-source-control"),
    RoonApiVolumeControl = require('node-roon-api-volume-control');

var onkyo = {};

var roon = new RoonApi({
    extension_id:        'org.marcelveldt.roon.onkyo',
    display_name:        'Onkyo/Pioneer AVR',
    display_version:     '0.0.1',
    publisher:           'Marcel van der Veldt',
    email:               'm.vanderveldt@outlook.com',
    website:             'https://github.com/marcelveldt/roon-extension-onkyo',
});

var mysettings = roon.load_config("settings") || {
    hostname: "",
    source: "strm-box"
};

function make_layout(settings) {
    var l = {
        values:    settings,
        layout:    [],
        has_error: false
    };

    l.layout.push({
        type:      "string",
        title:     "Host name or IP Address",
        subtitle:  "The IP address or hostname of the Onkyo/Pioneer receiver. Will be auto detected if left blank.",
        maxlength: 256,
        setting:   "hostname",
    });
    l.layout.push({
        type:      "string",
        title:     "Source",
        subtitle:  "The source of the AVR for your music playback. (e.g. strm-box or bd)",
        maxlength: 10,
        setting:   "source",
    });

    return l;
}

var svc_settings = new RoonApiSettings(roon, {
    get_settings: function(cb) {
        cb(make_layout(mysettings));
    },
    save_settings: function(req, isdryrun, settings) {
        let l = make_layout(settings.values);
        req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

        if (!isdryrun && !l.has_error) {
            var old_hostname = mysettings.hostname;
            mysettings = l.values;
            svc_settings.update_settings(l);
            if (old_hostname != mysettings.hostname) setup(mysettings.hostname);
            roon.save_config("settings", mysettings);
        }
    }
});

var svc_status = new RoonApiStatus(roon);
var svc_volume_control = new RoonApiVolumeControl(roon);
var svc_source_control = new RoonApiSourceControl(roon);

roon.init_services({
    provided_services: [ svc_status, svc_settings, svc_volume_control, svc_source_control ]
});

function setup(host) {
    debug("setup onkyo connection (" + host + ")");

    // delete any previous connections
    if (onkyo.source_control) {
        onkyo.source_control.destroy();
        delete(onkyo.source_control);
    }
    if (onkyo.volume_control) {
        onkyo.volume_control.destroy();
        delete(onkyo.volume_control);
    }

    debug("Connecting to receiver...");
    svc_status.set_status("Connecting to receiver " + host + "...", false);

    // Prints debugging info to the terminal
    eiscp.on("debug", util.log);
    eiscp.on("error", util.log);

    eiscp.on('connect', ev_connected);
    eiscp.on('master-volume', ev_volume);
    eiscp.on('input-selector', ev_source);
    eiscp.on('system-power', ev_power);
    eiscp.on('audio-muting', ev_mute);

    var config = { reconnect: true, reconnect_sleep: 5, verify_commands: false, send_delay: 0 };
    eiscp.connect(config);
}

function ev_connected(data) {
    debug("%s", data);
    
    if (onkyo.volume_value)
        debug("Reconnected to receiver...");
    else {

        svc_status.set_status("Connected to receiver...", false);
        debug("Registering volume control extension...");
        onkyo.volume_value = 20; // initial state
        onkyo.volume_control = svc_volume_control.new_device({
            state: {
                display_name: "Onkyo", // XXX need better less generic name -- can we get serial number from the controller?
                volume_type:  "number",
                volume_min:   1,
                volume_max:   100,
                volume_value: onkyo.volume_value,
                volume_step:  5,
                is_muted:     false
            },
            set_volume: function (req, mode, value) {
                debug("set_volume: mode=%s value=%d", mode, value);
                let newvol = mode == "absolute" ? value : (onkyo.volume_value + value);
                if      (newvol < this.state.volume_min) newvol = this.state.volume_min;
                else if (newvol > this.state.volume_max) newvol = this.state.volume_max;
                
                if (onkyo.volume_value != newvol) {
                    eiscp.command("master-volume=" + newvol);
                    onkyo.volume_value = newvol;
        			onkyo.volume_control.update_state({ volume_value: newvol });
                    debug("set_volume: Succeeded.");
                }
                else debug("set_volume: not needed or already in progress...");
                
                req.send_complete("Success");
            },
            set_mute: function (req, action) {
                debug("set_mute: action=%s", action);
                eiscp.command("audio-muting=toggle");
            }
        });

        debug("Registering source control extension...");
        onkyo.source_control = svc_source_control.new_device({
            state: {
                display_name:     "Onkyo",
                supports_standby: true,
                status:           "standby"
            },
            convenience_switch: function (req) {
                debug("convenience_switch called")
                //control.set_source(mysettings.setsource, err => { req.send_complete(err ? "Failed" : "Success"); });
                eiscp.command("input-selector=" + mysettings.source);
                req.send_complete("Success");
            },
            standby: function (req) {
                let state = this.state.status;
                this.state.status = (state == "selected")? "standby": "selected";
                var new_pwr = (state == "selected")? "standby": "on";
                eiscp.command("system-power=" + new_pwr);
                req.send_complete("Success");
            }
        });

        // request initial states
        eiscp.command("input-selector=query");
        eiscp.command("system-power=query");
        eiscp.command("master-volume=query");
        eiscp.command("audio-muting=query");

    }
}


function ev_volume(val) {
    debug("[Onkyo] received volume change from device:", val);
    if (onkyo.volume_control && onkyo.volume_value != val) {
        onkyo.volume_value = val;
        onkyo.volume_control.update_state({ volume_value: val });
        debug("update_state: Succeeded.");
    }
}

function ev_mute(val) {
    debug("received mute change from device:", val);
    if (val == "on" && onkyo.volume_control)
        onkyo.volume_control.update_state({ is_muted: true });
    else {
    if (onkyo.volume_control)
        onkyo.volume_control.update_state({ is_muted: false });
    }
}

function ev_source(val) {
    debug("received source change from device:", val);
	if (val.indexOf(mysettings.source) > -1)
        onkyo.source_control.update_state({ status: "selected" });
    else
    	onkyo.source_control.update_state({ status: "standby" });
}

function ev_power(val) {
    debug("received power change from device:", val);
    if (val == "standby")
        onkyo.source_control.update_state({ status: "standby" });
}

setup(mysettings.hostname);

roon.start_discovery();
