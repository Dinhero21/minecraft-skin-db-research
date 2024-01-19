import { copyFile, readdir } from 'fs/promises'
import { resolve } from 'path'
import sharp from 'sharp'

const INPUT_DIRECTORY = 'skins-valid-FULL'

const OUTPUT_DIRECTORY = 'skins-square-FULL'

const BATCH_SIZE = 256

let count = 0
let batches = 0

const files = await readdir(INPUT_DIRECTORY)

const fileCount = files.length

const interval = setInterval(() => {
  console.info(`${String(count / fileCount * 100).substring(0, 8)}% (${count} / ${fileCount}) (${batches} batches)`)
}, 1000 / 12)

while (files.length > 0) {
  const batch = files.splice(0, BATCH_SIZE)

  const promises: Array<Promise<void>> = []

  for (const file of batch) {
    const path = resolve(INPUT_DIRECTORY, file)

    promises.push(
      (async () => {
        let image

        try {
          // It is needed to attempt to parse the data (and not only the metadata) to ensure the file is not corrupt
          image = await sharp(path)
            .raw()
            .toBuffer({ resolveWithObject: true })
        } catch (error) {
          console.error(error)

          count++

          return
        }

        const info = image.info

        if (info.width !== 64 || info.height !== 64) {
          count++

          return
        }

        await copyFile(path, resolve(OUTPUT_DIRECTORY, file))

        count++
      })()
    )
  }

  await Promise.all(promises)

  batches++
}

clearInterval(interval)
