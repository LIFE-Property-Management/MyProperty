import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

describe('useMediaQuery', () => {
  type Listener = (event: MediaQueryListEvent) => void;

  let listeners: Listener[] = [];
  let matches = false;

  beforeEach(() => {
    listeners = [];
    matches = false;

    (window as unknown as { matchMedia: unknown }).matchMedia = jest
      .fn()
      .mockImplementation((_query: string) => ({
        get matches() {
          return matches;
        },
        media: _query,
        addEventListener: (_evt: string, cb: Listener) => {
          listeners.push(cb);
        },
        removeEventListener: (_evt: string, cb: Listener) => {
          listeners = listeners.filter((l) => l !== cb);
        },
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
        onchange: null,
      }));
  });

  it('returns a boolean value', () => {
    matches = true;
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(typeof result.current).toBe('boolean');
  });

  it('reflects matchMedia.matches after mount', () => {
    matches = true;
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('updates when the media query change event fires', () => {
    matches = false;
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      listeners.forEach((l) => l({ matches: true } as MediaQueryListEvent));
    });

    expect(result.current).toBe(true);
  });

  it('cleans up the listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(listeners.length).toBe(1);
    unmount();
    expect(listeners.length).toBe(0);
  });
});
