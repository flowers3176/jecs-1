export interface Signal<T extends Array<unknown>> {
	connect(func: (...args: T) => void): void;
	fire(...args: T): void;
}

export function createSignal<T extends Array<unknown>>(): Signal<T> {
	const listeners: Array<(...args: T) => void> = [];

	return {
		connect(func: (...args: T) => void): void {
			listeners.push(func);
		},

		fire(...args: T): void {
			for (const listener of listeners) {
				listener(...args);
			}
		},
	};
}
