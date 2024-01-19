import { constants, createInflate } from 'zlib'
import { TypedEmitter } from 'tiny-typed-emitter'

interface MetaFileSplitterEventMap {
  data: (buffer: Buffer) => void
}

export class MetaFileSplitter extends TypedEmitter<MetaFileSplitterEventMap> {
  public stream = createInflate({
    finishFlush: constants.Z_SYNC_FLUSH
  })

  public files = 0

  private buffer = Buffer.alloc(0)

  constructor (bytes: number) {
    super()

    this.stream.on('data', (chunk: string) => {
      const chunkBuffer = Buffer.from(chunk)

      const concatenatedImages = Buffer.concat([this.buffer, chunkBuffer])

      let data: Buffer

      let i = 0

      while (true) {
        data = concatenatedImages.subarray(i, i + bytes)

        if (data.length < bytes) {
          break
        }

        this.emit('data', data)

        i += bytes

        this.files++
      }

      this.buffer = data
    })
  }
}
