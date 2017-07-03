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
    debuglog = require('util').debuglog('led'),
    ledResource,
    sensorPin,
    exitId,
    observerCount = 0,
    sensorState = false,
    resourceTypeName = 'oic.r.led',
    resourceInterfaceName = '/a/led',
    simulationMode = false;

// Parse command-line arguments
var args = process.argv.slice(2);
args.forEach(function(entry) {
    if (entry === "--simulation" || entry === "-s") {
        simulationMode = true;
        debuglog('Running in simulation mode');
    };
});

// Require the MRAA library
var mraa = '';
if (!simulationMode) {
    try {
        mraa = require('mraa');
    }
    catch (e) {
        debuglog('No mraa module: ', e.message);
        debuglog('Automatically switching to simulation mode');
        simulationMode = true;
    }
}

// Setup LED sensor pin.
function setupHardware() {
    if (mraa) {
        sensorPin = new mraa.Gpio(2);
        sensorPin.dir(mraa.DIR_OUT);
        sensorPin.write(0);
    }
}

// This function parce the incoming Resource properties
// and change the sensor state.
function updateProperties(properties) {
    sensorState = properties.value;

    debuglog('Update received. value: ', sensorState);

    if (simulationMode)
        return;

    if (sensorState)
        sensorPin.write(1);
    else
        sensorPin.write(0);
}

// This function construct the payload and returns when
// the GET request received from the client.
function getProperties() {
    // Format the payload.
    var properties = {
        rt: resourceTypeName,
        id: 'led',
        value: sensorState
    };

    debuglog('Send the response. value: ', sensorState);
    return properties;
}

// Set up the notification loop
function notifyObservers(request) {
    ledResource.properties = getProperties();

    ledResource.notify().then(
        function() {
            debuglog('Successfully notified observers.');
        },
        function(error) {
            debuglog('Notify failed with error: ', error);
        });
}

// Event handlers for the registered resource.
function retrieveHandler(request) {
    ledResource.properties = getProperties();
    request.respond(ledResource).catch(handleError);

    if ('observe' in request) {
        observerCount += request.observe ? 1 : -1;
        if (observerCount > 0)
            setTimeout(notifyObservers, 200);
    }
}

function updateHandler(request) {
    updateProperties(request.data);
    ledResource.properties = getProperties();

    request.respond(ledResource).catch(handleError);
    if (observerCount > 0)
        setTimeout(notifyObservers, 200);
}

device.device = Object.assign(device.device, {
    name: 'Smart Home LED',
    coreSpecVersion: 'core.1.1.0',
    dataModels: ['res.1.1.0']
});

function handleError(error) {
    debuglog('LED: Failed to send response with error: ', error);
}

device.platform = Object.assign(device.platform, {
    manufacturerName: 'Intel',
    manufactureDate: new Date('Fri Oct 30 10:04:17 (EET) 2015'),
    platformVersion: '1.1.0',
    firmwareVersion: '0.0.1'
});

// Enable presence
if (device.device.uuid) {
    // Setup LED pin.
    setupHardware();

    debuglog('Create LED resource.');

    // Register LED resource
    device.server.register({
        resourcePath: resourceInterfaceName,
        resourceTypes: [resourceTypeName],
        interfaces: ['oic.if.baseline'],
        discoverable: true,
        observable: true,
        properties: getProperties()
    }).then(
        function(resource) {
            debuglog('register() resource successful');
            ledResource = resource;

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
    debuglog('Delete LED Resource.');

    if (exitId)
        return;

    // Turn off LED before we tear down the resource.
    if (mraa)
        sensorPin.write(0);

    // Unregister resource.
    ledResource.unregister().then(
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
