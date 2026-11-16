/** One asynchronous task that a runner starts when a slot is free. */
export type AsyncTask = () => Promise<void>;

/**
 * Creates a runner that runs at most `maxConcurrency` tasks at once. A task
 * with a free slot starts at once, in the same call. A task that finds no
 * free slot waits, and a released slot goes to the oldest waiting task.
 *
 * @internal
 */
export function createAsyncTaskRunner(
	maxConcurrency: number,
): (task: AsyncTask) => Promise<void> {
	let running = 0;
	const waiting: (() => void)[] = [];
	let nextWaiting = 0;

	// A released slot passes directly to the next waiting task, so the count
	// of running tasks stays the same.
	const release = (): void => {
		if (nextWaiting < waiting.length) {
			const next = waiting[nextWaiting++];
			if (nextWaiting === waiting.length) {
				waiting.length = 0;
				nextWaiting = 0;
			}
			next();
			return;
		}
		running--;
	};

	const runInSlot = async (task: AsyncTask): Promise<void> => {
		try {
			await task();
		} finally {
			release();
		}
	};

	return (task) => {
		if (running < maxConcurrency) {
			running++;
			return runInSlot(task);
		}
		return new Promise<void>((resolve) => {
			waiting.push(resolve);
		}).then(() => runInSlot(task));
	};
}
