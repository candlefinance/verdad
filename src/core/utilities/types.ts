// --- Collection element types

export type RecordKeyType<RecordType> = RecordType extends Record<infer Key, any> ? Key : never 
export type RecordValueType<RecordType> = RecordType extends Record<any, infer Value> ? Value : never

export type ArrayElementType<ArrayType> = ArrayType extends Array<infer Element> ? Element : never

// --- Number range types

type PrependNextNum<A extends Array<unknown>> = A['length'] extends infer T ? ((t: T, ...a: A) => void) extends ((...x: infer X) => void) ? X : never : never;
type EnumerateInternal<A extends Array<unknown>, N extends number> = { 0: A, 1: EnumerateInternal<PrependNextNum<A>, N> }[N extends A['length'] ? 0 : 1];

export type Enumerate<N extends number> = EnumerateInternal<[], N> extends (infer E)[] ? E : never;
export type Range<FROM extends number, TO extends number> = Exclude<Enumerate<TO>, Enumerate<FROM>>;