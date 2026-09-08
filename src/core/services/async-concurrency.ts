type AsyncTask = () => Promise<void>;

/**
 * Creates a runner that reserves at most `maxConcurrency` task slots.
 * A released slot goes directly to the oldest waiting task.
 *
 * @internal
 */
export const createAsyncTaskRunner = (
	maxConcurrency: number,
): ((task: AsyncTask) => Promise<void>) => {
	let activeCount = 0;
	let nextWaiterIndex = 0;
	const waiters: Array<() => void> = [];

	const acquire = async (): Promise<void> => {
		if (activeCount < maxConcurrency) {
			activeCount++;
			return;
		}

		await new Promise<void>((resolve) => {
			waiters.push(resolve);
		});
	};

	const release = (): void => {
		const nextWaiter = waiters[nextWaiterIndex];
		if (nextWaiter) {
			nextWaiterIndex++;
			nextWaiter();
			if (nextWaiterIndex === waiters.length) {
				waiters.length = 0;
				nextWaiterIndex = 0;
			}
			return;
		}
		activeCount--;
	};

	return async (task): Promise<void> => {
		await acquire();
		try {
			await task();
		} finally {
			release();
		}
	};
};
