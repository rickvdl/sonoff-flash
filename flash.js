const axios = require('axios')

const ip = process.env.IP_ADDRESS
const deviceId = process.env.DEVICE_ID
const firmwareUrl = process.env.FIRMWARE_URL
const sha256 = process.env.SHA_256

const ensureEnv = () => {
  if (!ip) {
    missingEnv('the Sonoff\'s IP address', 'IP_ADDRESS')
  }

  if (!deviceId) {
    missingEnv('the Sonoff\'s device ID', 'DEVICE_ID')
  }

  if (!firmwareUrl) {
    missingEnv('the url to download the firmware from', 'FIRMWARE_URL')
  }

  if (!sha256) {
    missingEnv('the firmware\'s SHA 256 hash', 'SHA_256')
  }
}

const missingEnv = (name, env) => {
  console.log(`Please pass ${name} using the environment variable ${env}`)
  process.exit(1)
}

const testConnection = async () => {
  const test = await call('signal_strength')

  if (!test || test.error) {
    throw 'Connection to Sonoff failed'
  }

  console.log(`Successfully connected to Sonoff on IP ${ip}`)
}

const unlockOTA = async () => {
  const info = await call('info')

  if (info.data.otaUnlock) {
    console.log('Sonoff already unlocked for OTA flashing')
    return
  }

  await call('ota_unlock')
  console.log('Sonoff successfully unlocked for OTA flashing')
}

const testFirmwareUrl = async () => {
  try {
    const response = await axios.get(firmwareUrl)

    if (!response.headers['content-type'] || response.headers['content-type'] != 'application/octet-stream') {
      throw 'The content-type header does not indicate the application/octet-stream type, is the URL correct?'
    }

    if (!response.headers['accept-ranges'] || response.headers['accept-ranges'] != 'bytes') {
      throw 'The firmware download URL does not appear to support the range header, which is required by the Sonoff.'
    }

    console.log('Firmware download URL passed the required tests')
  }
  catch (error) { 
    if (typeof error == 'string') {
      throw error
    }

    console.log(`An error occured during a test of the firmware download URL, please verify the download URL (${firmwareUrl}) is correct`)
    if (error.response) {
      console.log(`HTTP error ${error.response.status} (${error.response.statusText})`)
    }
  }
}

const updateFirmware = async () => {

  console.log('Flashing Sonoff firmware...')

  await call('ota_flash', {
    downloadUrl: firmwareUrl,
    sha256sum: sha256
  })

  s = 30
  const timer = setInterval(() => {
    console.log(`Waiting for Sonoff to finish flashing in ${s} seconds...`)
    s-=1
    if (s == 0) {
      console.log(`Successfully flashed the Sonoff device!`)
      clearInterval(timer)
    }
  }, 1000)
}

const run = async () => {
  await ensureEnv()

  await testConnection()

  await unlockOTA()

  await testFirmwareUrl()

  await updateFirmware()
}

const call = async (path, data = {}) => {
  const body = Object.assign({ deviceid: deviceId }, { data })
  return axios.post(`http://${ip}:8081/zeroconf/${path}`, body)
    .then((response) => {
      let data = response.data
      if (data.data) {
        data.data = JSON.parse(data.data)
      }
      return data
    })
}

;(async () => {
  
  try {
    await run()
  }
  catch(error) {
    console.log(error)
  }
})()