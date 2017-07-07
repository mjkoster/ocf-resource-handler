TradfriCoapdtls = require("tradfri-coapdtls")
tradfriHub = new TradfriCoapdtls({securityId: "n65inIza8MtG5Spd" , hubIpAddress: "10.0.0.13"})
tradfriHub.connect()
  .then( (val) =>
    tradfriHub._send_request('/.well-known/core')
    .then( (res) => {
      console.log(res)
      process.exit()
    })
    .catch( (res) => {
      console.log(res)
      process.exit()
    })
  )
  .catch( (error) =>
    console.log(error)
  )
