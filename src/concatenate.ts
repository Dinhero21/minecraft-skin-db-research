import { createWriteStream } from 'fs'
import { readdir } from 'fs/promises'
import { resolve } from 'path'
import { createDeflate } from 'zlib'
import sharp from 'sharp'

const INPUT_DIRECTORY = 'skinssquare'

const OUTPUT_FILE = 'metaskin'

const BATCH_SIZE = 256

let count = 0
let batches = 0

const files = await readdir(INPUT_DIRECTORY)

const fileCount = files.length

const interval = setInterval(() => {
  console.info(`${String(count / fileCount * 100).substring(0, 8)}% (${count} / ${fileCount}) (${batches} batches)`)
}, 1000 / 12)

// const gzip = spawn('gzip', [
//   '-f', // Force compression (gzip does not compress via stdin/stdout by default)
//   '-c' // Write output to stdout (implicit)
// ])

const output = createWriteStream(OUTPUT_FILE)

const compression = createDeflate()

compression.pipe(output)

// gzip.stdout.pipe(output)

while (files.length > 0) {
  const batch = files.splice(0, BATCH_SIZE)

  const promises: Array<Promise<void>> = []

  for (const file of batch) {
    const path = resolve(INPUT_DIRECTORY, file)

    promises.push(
      (async () => {
        let image

        try {
          image = await sharp(path)
            .raw()
            .toBuffer({ resolveWithObject: true })
        } catch (error) {
          console.error(error)

          count++

          return
        }

        const data = image.data

        compression.write(data)

        count++
      })()
    )
  }

  await Promise.all(promises)

  batches++
}

clearInterval(interval)
