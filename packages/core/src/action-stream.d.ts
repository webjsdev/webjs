/** Streaming RPC wire protocol (#489). See action-stream.js. */

export declare const STREAM_CONTENT_TYPE: string;
export declare const FRAME_CHUNK: number;
export declare const FRAME_END: number;
export declare const FRAME_ERROR: number;

export declare function encodeFrame(type: number, payload?: Uint8Array): Uint8Array;

export declare function createFrameDecoder(): {
  push(chunk: Uint8Array): Array<{ type: number; payload: Uint8Array }>;
};
