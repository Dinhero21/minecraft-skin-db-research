import { MetaFileSplitter } from './stream.js'
import { createReadStream } from 'fs'
import sharp from 'sharp'

const SKIN_META_FILE = 'metaskin'

const SKIN_WIDTH = 64
const SKIN_HEIGHT = 64
const SKIN_CHANNELS = 4

const SKIN_PIXELS = SKIN_WIDTH * SKIN_HEIGHT
const SKIN_BYTES = SKIN_PIXELS * SKIN_CHANNELS

// TODO: Find a less horrendous way of sharing data like this between calculations
const totalPixelAlpha: number[] = Array(SKIN_PIXELS).fill(0)

async function calculateAverage (): Promise<number[]> {
  const total: number[] = Array(SKIN_BYTES).fill(0)

  const splitter = new MetaFileSplitter(SKIN_BYTES)

  splitter.on('data', buffer => {
    for (let i = 0; i < buffer.length; i += 4) {
      const alpha = buffer[i + 3] / 256

      total[i + 0] += buffer[i + 0] * alpha
      total[i + 1] += buffer[i + 1] * alpha
      total[i + 2] += buffer[i + 2] * alpha
      total[i + 3] += buffer[i + 3]
    }
  })

  createReadStream(SKIN_META_FILE).pipe(splitter.stream)

  await new Promise<void>(resolve => splitter.stream.on('end', resolve))

  for (let i = 0; i < totalPixelAlpha.length; i++) {
    const alpha = total[(i * 4) + 3] / 256

    totalPixelAlpha[i] = alpha
  }

  const average = Array.from(total)

  for (let iPixel = 0; iPixel < totalPixelAlpha.length; iPixel++) {
    const iByte = iPixel * 4

    const alpha = totalPixelAlpha[iPixel]

    average[iByte + 0] /= alpha
    average[iByte + 1] /= alpha
    average[iByte + 2] /= alpha
    average[iByte + 3] /= splitter.files
  }

  return average
}

async function calculateStandardDeviation (average: number[]): Promise<number[]> {
  const squareStandardDeviation: number[] = Array(SKIN_PIXELS * 3).fill(0)

  const splitter = new MetaFileSplitter(SKIN_BYTES)

  splitter.on('data', buffer => {
    for (let iPixel = 0; iPixel < SKIN_PIXELS; iPixel++) {
      const iByteRGBA = iPixel * 4

      const alpha = buffer[iByteRGBA + 3] / 256

      const totalAlpha = totalPixelAlpha[iPixel]

      const r = buffer[iByteRGBA + 0] * alpha / totalAlpha
      const g = buffer[iByteRGBA + 1] * alpha / totalAlpha
      const b = buffer[iByteRGBA + 2] * alpha / totalAlpha

      const iByteRGB = iPixel * 3

      squareStandardDeviation[iByteRGB + 0] += Math.pow(r - average[iByteRGBA + 0], 2)
      squareStandardDeviation[iByteRGB + 1] += Math.pow(g - average[iByteRGBA + 1], 2)
      squareStandardDeviation[iByteRGB + 2] += Math.pow(b - average[iByteRGBA + 2], 2)
    }
  })

  createReadStream(SKIN_META_FILE).pipe(splitter.stream)

  await new Promise<void>(resolve => splitter.stream.on('end', resolve))

  const standardDeviation = squareStandardDeviation.map(Math.sqrt)

  console.log(standardDeviation)

  return standardDeviation
}

const average = await calculateAverage()

const averageBuffer = Buffer.from(average)

await sharp(averageBuffer, {
  raw: {
    width: SKIN_WIDTH,
    height: SKIN_HEIGHT,
    channels: SKIN_CHANNELS
  }
})
  .toFile('./average.png')

const standardDeviation = await calculateStandardDeviation(average)

const totalStandardDeviation = standardDeviation.reduce((a, b) => a + b, 0)

const averageStandardDeviation = totalStandardDeviation / standardDeviation.length

const normalizedStandardDeviation = standardDeviation.map(n => n / averageStandardDeviation * 256)

const standardDeviationBuffer = Buffer.from(normalizedStandardDeviation)

await sharp(standardDeviationBuffer, {
  raw: {
    width: SKIN_WIDTH,
    height: SKIN_HEIGHT,
    channels: 3
  }
})
  .toFile('./standard-deviation.rgb.png')

const standardDeviationBufferRGBA = Buffer.allocUnsafe(SKIN_BYTES)

// α(average) -> α(standard deviation)
for (let iPixel = 0; iPixel < SKIN_PIXELS; iPixel++) {
  const iByteRGBA = iPixel * 4
  const iByteRGB = iPixel * 3

  standardDeviationBufferRGBA[iByteRGBA + 0] = standardDeviationBuffer[iByteRGB + 0]
  standardDeviationBufferRGBA[iByteRGBA + 1] = standardDeviationBuffer[iByteRGB + 1]
  standardDeviationBufferRGBA[iByteRGBA + 2] = standardDeviationBuffer[iByteRGB + 2]
  standardDeviationBufferRGBA[iByteRGBA + 3] = averageBuffer[iByteRGBA + 3]
}

await sharp(standardDeviationBufferRGBA, {
  raw: {
    width: SKIN_WIDTH,
    height: SKIN_HEIGHT,
    channels: 4
  }
})
  .toFile('./standard-deviation.average-alpha.png')
