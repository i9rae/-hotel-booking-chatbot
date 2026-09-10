import { BsCalendar } from "react-icons/bs";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../style/datepicker.css";
import { useRoomContext } from "../context/RoomContext";

/** CheckIn datepicker props: placement of calendar popover and optional full-width in container. */
type CheckInProps = {
  popperPlacement?: "bottom-start" | "bottom-end";
  popperFullWidth?: boolean;
};

/**
 * Check-in date field: react-datepicker with calendar icon toggle and single-calendar coordination.
 * - Controlled via RoomContext (checkIn/setCheckIn) so the value is shared across the whole app
 *   (search bar, RoomDetails reservation form, and the chatbot which can pre-fill it).
 * - Only one of CheckIn/CheckOut can be open at a time (custom event DATEPICKER_OPEN with id "checkin").
 * - suppressOpenRef prevents the lib's open logic from re-opening right after we close (e.g. on icon click).
 * - popperFullWidth: sets CSS var --datepicker-popper-width so calendar spans the wrapper (e.g. Room Details).
 */
export default function CheckIn({
  popperPlacement = "bottom-start",
  popperFullWidth = false,
}: CheckInProps) {
  const { checkIn, setCheckIn } = useRoomContext();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const suppressOpenRef = useRef(false);
  const DATEPICKER_OPEN = "datepicker-open";
  const ID = "checkin";

  // Close when clicking outside the wrapper (mousedown so it runs before focus moves).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // When the other datepicker (CheckOut) opens, this one closes so only one calendar is visible.
  useEffect(() => {
    const onOtherOpen = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail?.id !== ID) setIsOpen(false);
    };
    document.addEventListener(DATEPICKER_OPEN, onOtherOpen);
    return () => document.removeEventListener(DATEPICKER_OPEN, onOtherOpen);
  }, []);

  // For Room Details: set --datepicker-popper-width so full-width calendar matches wrapper width.
  useLayoutEffect(() => {
    if (!popperFullWidth || !isOpen) return;
    const w = wrapperRef.current?.offsetWidth;
    if (w) document.body.style.setProperty("--datepicker-popper-width", `${w}px`);
    return () => {
      document.body.style.removeProperty("--datepicker-popper-width");
    };
  }, [popperFullWidth, isOpen]);

  // Icon toggle: set suppress so datepicker's onInputClick doesn't re-open; dispatch so CheckOut closes.
  const handleIconClick = () => {
    suppressOpenRef.current = true;
    setIsOpen((o) => {
      if (!o) document.dispatchEvent(new CustomEvent(DATEPICKER_OPEN, { detail: { id: ID } }));
      return !o;
    });
    setTimeout(() => {
      suppressOpenRef.current = false;
    }, 200);
  };

  // Open from input/calendar: only if not suppressed; notify others so they close.
  const handleOpen = () => {
    if (suppressOpenRef.current) return;
    document.dispatchEvent(new CustomEvent(DATEPICKER_OPEN, { detail: { id: ID } }));
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // On date select: update shared context, close calendar, briefly suppress to avoid re-open.
  const handleChange = (date: Date | null) => {
    setCheckIn(date);
    suppressOpenRef.current = true;
    setIsOpen(false);
    setTimeout(() => {
      suppressOpenRef.current = false;
    }, 200);
  };

  return (
    <div ref={wrapperRef} className="relative flex items-center justify-end h-full w-full min-w-0">
      <div
        className="absolute z-10 pr-8 cursor-pointer"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleIconClick();
        }}
        onClick={(e) => e.preventDefault()}
        onKeyDown={(e) => e.key === "Enter" && handleIconClick()}
        role="button"
        tabIndex={0}
        aria-label="Toggle calendar"
      >
        <div>
          <BsCalendar className="text-accent text-base" />
        </div>
      </div>
      <DatePicker
        className="w-full h-full"
        selected={checkIn}
        placeholderText="Check in"
        onChange={handleChange}
        popperPlacement={popperPlacement}
        popperClassName={popperFullWidth ? "datepicker-popper-fullwidth" : undefined}
        open={isOpen}
        onInputClick={handleOpen}
        onCalendarOpen={handleOpen}
        onCalendarClose={handleClose}
        onClickOutside={handleClose}
      />
    </div>
  );
}
