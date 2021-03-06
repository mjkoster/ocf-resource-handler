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
    debuglog = require('util').debuglog('motion'),
    motionResource,
    exitId,
    observerCount = 0,
    resourceTypeNames = ['oic.r.sensor.motion'],
    interfaceTypeNames = ['oic.if.baseline'],
    resourceEntryPoint = '/motion',
    motionstate = false,
    tradfripsk = "mk75jHZuEEBHyr4c",
    tradfriIP = "10.0.0.30",
    tradfrideviceID = 65537,
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
  debuglog('Update received: ', properties);

  var propertymap = {};
  if ('value' in properties) {
    motionstate = properties.value;
    propertymap.value = (motionstate ? true : false );
  }

  if(Tradfri) {
    tradfriHub.setDevice(
      tradfrideviceID,
      propertymap,
    )
    .then( (res) => {
      console.log("device updated", propertymap)
    });
  }
}
// This function obtains the current data and
// constructs the payload to return to the client.
function getProperties() {
    // Format the payload.
    var properties = {
      value: motionstate
    };
    debuglog('Send the response: ', properties);
    return properties;
}

// Set up the notification loop
function notifyObservers(request) {
    motionResource.properties = getProperties();

    motionResource.notify().catch(
        function(error) {
            debuglog('Notify failed with error: ', error);
        });
}

// Event handlers for the registered resource.
function retrieveHandler(request) {
    motionResource.properties = getProperties();
    request.respond(motionResource).catch(handleError);

    if ('observe' in request) {
        observerCount += request.observe ? 1 : -1;
        if (observerCount > 0)
            setTimeout(notifyObservers, 200);
    }
}

function updateHandler(request) {
    updateProperties(request.data);

    motionResource.properties = getProperties();
    request.respond(motionResource).catch(handleError);
    if (observerCount > 0)
        setTimeout(notifyObservers, 200);
}

function handleError(error) {
    debuglog('Failed to send response with error: ', error);
}

function setupHardware() {
  if (Tradfri) {
    tradfriHub = new Tradfri({securityId: tradfripsk , hubIpAddress: tradfriIP });
    tradfriHub.connect().then( console.log('connected'));
  }
}

device.device = Object.assign(device.device, {
    name: 'Tradfri motion',
    coreSpecVersion: 'core.1.1.0',
    dataModels: ['res.1.1.0']
});

device.platform = Object.assign(device.platform, {
    manufacturerName: 'iotivity-node',
    manufactureDate: new Date('Tue July 4 00:00:00 (PDT) 2017'),
    platformVersion: '1.1.0',
    firmwareVersion: '0.0.1'
});

if (device.device.uuid) {

    if (!simulationMode) {
        try {
            setupHardware();
        }
        catch (e) {
            debuglog('setup error');
            debuglog('Automatically switching to simulation mode');
            simulationMode = true;
        }
    }

    debuglog('Create light resource.');

    // Register resource
    device.server.register({
        resourcePath: resourceEntryPoint,
        resourceTypes: resourceTypeNames,
        interfaces: interfaceTypeNames,
        discoverable: true,
        observable: true,
        properties: getProperties()
    }).then(
        function(resource) {
            console.log('registered');
            debuglog('register() resource successful');
            motionResource = resource;

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
    debuglog('Delete motion Resource.');

    if (exitId)
        return;

    // clean up motion stuff before we tear down the resource.
    if (Tradfri) {
    }

    // Unregister resource.
    motionResource.unregister().then(
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
