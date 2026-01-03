/**
 * Injectable clock provider for time-dependent operations.
 * Allows for testing with fake/mocked time without affecting system clock.
 */

export interface ClockProvider {
  now(): Date;
}

/**
 * Default clock provider using the system clock
 */
class SystemClock implements ClockProvider {
  now(): Date {
    return new Date();
  }
}

/**
 * Fake clock for testing - allows setting a specific time
 */
export class FakeClock implements ClockProvider {
  private currentTime: Date;

  constructor(initialTime: Date = new Date()) {
    this.currentTime = new Date(initialTime);
  }

  now(): Date {
    return new Date(this.currentTime);
  }

  /**
   * Set the current time
   */
  setTime(time: Date): void {
    this.currentTime = new Date(time);
  }

  /**
   * Advance time by the specified number of milliseconds
   */
  advance(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }

  /**
   * Advance time by the specified number of seconds
   */
  advanceSeconds(seconds: number): void {
    this.advance(seconds * 1000);
  }

  /**
   * Advance time by the specified number of minutes
   */
  advanceMinutes(minutes: number): void {
    this.advance(minutes * 60 * 1000);
  }

  /**
   * Advance time by the specified number of hours
   */
  advanceHours(hours: number): void {
    this.advance(hours * 60 * 60 * 1000);
  }
}

// Singleton instance for production use
let clockInstance: ClockProvider = new SystemClock();

/**
 * Get the current clock provider
 */
export function getClock(): ClockProvider {
  return clockInstance;
}

/**
 * Set the clock provider (for testing)
 */
export function setClock(clock: ClockProvider): void {
  clockInstance = clock;
}

/**
 * Reset to system clock (call after tests)
 */
export function resetClock(): void {
  clockInstance = new SystemClock();
}

/**
 * Get current time from the clock provider
 */
export function now(): Date {
  return clockInstance.now();
}

