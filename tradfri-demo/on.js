TradfriCoapdtls = require("tradfri-coapdtls")
tradfriHub = new TradfriCoapdtls({securityId: "n65inIza8MtG5Spd" , hubIpAddress: "10.0.0.13"})
tradfriHub.connect()
  .then( (val) =>
    tradfriHub.setDevice(
      65542,
      {
        state: 0
      },
      5
    )
    .then( (res) => {
      console.log("New value send to device")
      process.exit()
    })
  )
