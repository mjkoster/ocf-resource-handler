// Copyright 2017 Intel Corporation
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var device = require('iotivity-node'),
    debuglog = require('util').debuglog('batchlight'),
    lightResource,
    exitId,
    observerCount = 0,
    resourceTypeNames = ['oic.wk.col', 'oic.r.light'],
    interfaceTypeNames = ['oic.if.baseline', 'oic.if.b', 'oic.if.ll'],
    resourceEntryPoint = '/light/',
    onoffstate = false,
    dimmingvalue = 0,
    ramptimevalue = 0,
    tradfripsk = "n65inIza8MtG5Spd",
    tradfriIP = "10.0.0.13",
    tradfrideviceID = 65542,
    simulationMode = false;

// Parse command-line arguments
var args = process.argv.slice(2);
args.forEach(function(entry) {
    if (entry === "--simulation" || entry === "-s") {
        simulationMode = true;
        debuglog('Running in simulation mode');
    };
});

// Require the Tradfri library
var Tradfri = '';
if (!simulationMode) {
    try {
        Tradfri = require("tradfri-coapdtls")
    }
    catch (e) {
        debuglog('No TradfriCoapdtls module: ', e.message);
        debuglog('Automatically switching to simulation mode');
        simulationMode = true;
    }
}

// This function updates the resource properties
// and changes the actuator state.
function updateProperties(properties) {
  properties.forEach( function(element) {
    if (element.href == "onoff") {
      onoffstate = element.rep.value
    } else if (element.href == "level") {
      dimmingvalue = element.rep.dimming
    } else if (element.href == "ramptime") {
      ramptimevalue = element.rep.ramptime
    };
  });
    debuglog('Update received: ', properties);
}

// This function obtains the current data and
// constructs the payload to return to the client.
function getProperties() {
    // Format the payload.
    var properties = [
      {
        "href": "onoff",
        "rep": {
          "value": onoffstate
        }
      },
      {
        "href": "level",
        "rep": {
          "dimming": dimmingvalue
        }
      },
      {
        "href": "ramptime",
        "rep": {
          "value": ramptimevalue
        }
      }
    ];
    debuglog('Send the response: ', properties);
    return properties;
}

// Set up the notification loop
function notifyObservers(request) {
    lightResource.properties = getProperties();

    lightResource.notify().catch(
        function(error) {
            debuglog('Notify failed with error: ', error);
        });
}

// Event handlers for the registered resource.
function retrieveHandler(request) {
    lightResource.properties = getProperties();
    request.respond(lightResource).catch(handleError);

    if ('observe' in request) {
        observerCount += request.observe ? 1 : -1;
        if (observerCount > 0)
            setTimeout(notifyObservers, 200);
    }
}

function updateHandler(request) {
    updateProperties(request.data);

    lightResource.properties = getProperties();
    request.respond(lightResource).catch(handleError);
    if (observerCount > 0)
        setTimeout(notifyObservers, 200);
}

function handleError(error) {
    debuglog('Failed to send response with error: ', error);
}

function setupHardware() {
  if (Tradfri) {
    tradfriHub = new Tradfri({securityId: Tradfripsk , hubIpAddress: tradfriIP })
  }
}

device.device = Object.assign(device.device, {
    name: 'batch light',
    coreSpecVersion: 'core.1.1.0',
    dataModels: ['res.1.1.0']
});

device.platform = Object.assign(device.platform, {
    manufacturerName: 'iotivity-node',
    manufactureDate: new Date('Fri Oct 30 10:04:17 (EET) 2015'),
    platformVersion: '1.1.0',
    firmwareVersion: '0.0.1'
});

if (device.device.uuid) {

    setupHardware();

    debuglog('Create batch light resource.');

    // Register RGB LED resource
    device.server.register({
        resourcePath: resourceEntryPoint,
        resourceTypes: resourceTypeNames,
        interfaces: interfaceTypeNames,
        discoverable: true,
        observable: true,
        properties: getProperties()
    }).then(
        function(resource) {
            debuglog('register() resource successful');
            lightResource = resource;

            // Add event handlers for each supported request type
            resource.onretrieve(retrieveHandler);
            resource.onupdate(updateHandler);
        },
        function(error) {
            debuglog('register() resource failed with: ', error);
        });
}

// Cleanup when interrupted
function exitHandler() {
    debuglog('Delete light Resource.');

    if (exitId)
        return;

    // clean up light stuff before we tear down the resource.
    if (Tradfri) {
    }

    // Unregister resource.
    lightResource.unregister().then(
        function() {
            debuglog('unregister() resource successful');
        },
        function(error) {
            debuglog('unregister() resource failed with: ', error);
        });

    // Exit
    exitId = setTimeout(function() { process.exit(0); }, 1000);
}

// Exit gracefully
process.on('SIGINT', exitHandler);
process.on('SIGTERM', exitHandler);
