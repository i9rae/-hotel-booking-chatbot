import { BsCalendar } from "react-icons/bs";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../style/datepicker.css";
import { useRoomContext } from "../context/RoomContext";

/** CheckOut datepicker props: same as CheckIn (placement + optional full-width). */
type CheckOutProps = {
  popperPlacement?: "bottom-start" | "bottom-end";
  popperFullWidth?: boolean;
};

/**
 * Check-out date field: same behavior as CheckIn but with id "checkout" for single-calendar coordination.
 * Controlled via RoomContext (checkOut/setCheckOut), same rationale as CheckIn.
 * Opening this calendar dispatches DATEPICKER_OPEN so CheckIn closes; and vice versa.
 */
export default function CheckOut({
  popperPlacement = "bottom-start",
  popperFullWidth = false,
}: CheckOutProps) {
  const { checkIn, checkOut, setCheckOut } = useRoomContext();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const suppressOpenRef = useRef(false);
  const DATEPICKER_OPEN = "datepicker-open";
  const ID = "checkout";

  // Close when clicking outside.
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

  // When CheckIn opens, this calendar closes (and vice versa).
  useEffect(() => {
    const onOtherOpen = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail?.id !== ID) setIsOpen(false);
    };
    document.addEventListener(DATEPICKER_OPEN, onOtherOpen);
    return () => document.removeEventListener(DATEPICKER_OPEN, onOtherOpen);
  }, []);

  useLayoutEffect(() => {
    if (!popperFullWidth || !isOpen) return;
    const w = wrapperRef.current?.offsetWidth;
    if (w) document.body.style.setProperty("--datepicker-popper-width", `${w}px`);
    return () => {
      document.body.style.removeProperty("--datepicker-popper-width");
    };
  }, [popperFullWidth, isOpen]);

  // Icon toggle: same pattern as CheckIn (suppress + dispatch).
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

  const handleOpen = () => {
    if (suppressOpenRef.current) return;
    document.dispatchEvent(new CustomEvent(DATEPICKER_OPEN, { detail: { id: ID } }));
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleChange = (date: Date | null) => {
    setCheckOut(date);
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
        selected={checkOut}
        minDate={checkIn ?? undefined}
        placeholderText="Check out"
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

