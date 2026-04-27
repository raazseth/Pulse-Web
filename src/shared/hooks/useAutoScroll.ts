import { RefObject, useEffect, useRef, useState } from "react";

export function useAutoScroll<T extends HTMLElement>(
  ref: RefObject<T | null>,
  dependency: number,
) {
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const lastDependency = useRef(dependency);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const handleScroll = () => {
      const gap =
        element.scrollHeight - element.scrollTop - element.clientHeight;
      setIsPinnedToBottom(gap < 40);
    };

    handleScroll();
    element.addEventListener("scroll", handleScroll);
    return () => element.removeEventListener("scroll", handleScroll);
  }, [ref]);

  useEffect(() => {
    if (!ref.current || dependency === lastDependency.current) {
      return;
    }

    lastDependency.current = dependency;

    if (isPinnedToBottom) {
      ref.current.scrollTo({
        top: ref.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [dependency, isPinnedToBottom, ref]);

  return { isPinnedToBottom };
}
