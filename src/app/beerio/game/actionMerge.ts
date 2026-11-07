import { actionSequence } from './powerups';

/** Combine controller presses with a keyboard sequence without replaying stale packets. */
export function mergeControllerAction(lastControllerAction: number, localAction: number, value: unknown) {
  const controllerAction = actionSequence(value);
  return {
    lastControllerAction: Math.max(lastControllerAction, controllerAction),
    localAction: controllerAction > lastControllerAction
      ? Math.min(Number.MAX_SAFE_INTEGER, localAction + controllerAction - lastControllerAction)
      : localAction,
  };
}
