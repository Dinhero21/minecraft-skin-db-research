import { MetaFileSplitter } from './stream.js'
import { createReadStream } from 'fs'
import sharp from 'sharp'

const SKIN_META_FILE = 'metaskin'

const SKIN_WIDTH = 64
const SKIN_HEIGHT = 64
const SKIN_CHANNELS = 4

const SKIN_PIXELS = SKIN_WIDTH * SKIN_HEIGHT
const SKIN_BYTES = SKIN_PIXELS * SKIN_CHANNELS

async function calculateAverage (): Promise<number[]> {
  const total: number[] = Array(SKIN_BYTES).fill(0)

  const splitter = new MetaFileSplitter(SKIN_BYTES)

  splitter.on('data', buffer => {
    for (let i = 0; i < buffer.length; i++) {
      total[i] += buffer[i]
    }
  })

  createReadStream(SKIN_META_FILE).pipe(splitter.stream)

  await new Promise<void>(resolve => splitter.stream.on('end', resolve))

  const average = total.map(n => n / splitter.files)

  return average
}

async function calculateStandardDeviation (average: number[]): Promise<number[]> {
  const squareStandardDeviation: number[] = Array(SKIN_BYTES).fill(0)

  const splitter = new MetaFileSplitter(SKIN_BYTES)

  splitter.on('data', buffer => {
    for (let i = 0; i < buffer.length; i++) {
      squareStandardDeviation[i] += Math.pow(buffer[i] - average[i], 2)
    }
  })

  createReadStream(SKIN_META_FILE).pipe(splitter.stream)

  await new Promise<void>(resolve => splitter.stream.on('end', resolve))

  const standardDeviation = squareStandardDeviation.map(Math.sqrt)

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
    channels: SKIN_CHANNELS
  }
})
  .toFile('./standard-deviation.png')

await sharp(standardDeviationBuffer, {
  raw: {
    width: SKIN_WIDTH,
    height: SKIN_HEIGHT,
    channels: SKIN_CHANNELS
  }
})
  .removeAlpha()
  .toFile('./standard-deviation.rgb.png')

// α(average) -> α(standard deviation)
for (let i = 0; i < SKIN_BYTES; i += 4) {
  standardDeviationBuffer[i + 3] = averageBuffer[i + 3]
}

await sharp(standardDeviationBuffer, {
  raw: {
    width: SKIN_WIDTH,
    height: SKIN_HEIGHT,
    channels: SKIN_CHANNELS
  }
})
  .removeAlpha()
  .toFile('./standard-deviation.average-alpha.png')
