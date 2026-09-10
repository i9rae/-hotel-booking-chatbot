import {
  AdultsDropdown,
  CheckIn,
  CheckOut,
  KidsDropdown,
  ScrollToTop,
} from "../components";
import PriceSummary from "../components/PriceSummary";
import { useRoomContext } from "../context/RoomContext";
import { hotelRules } from "../data";
import { useParams } from "react-router-dom";
import { FaCheck } from "react-icons/fa";
import type { Facility } from "../types";

/**
 * Room detail page: hero, description, facilities grid, reservation sidebar (dates + guests), hotel rules.
 * Room is resolved from URL param :id via useParams(); we look up in context rooms (so filtered list applies).
 * If room not found (e.g. bad id or filtered out), we show "Room not found." CheckIn/CheckOut use popperFullWidth here.
 * checkIn/checkOut/adults/kids now come from the shared RoomContext (not local state), so a value set
 * elsewhere (e.g. the chatbot pre-filling a recommended date) is reflected here automatically.
 */
export default function RoomDetails() {
  const { id } = useParams<{ id: string }>();
  const { rooms, checkIn, checkOut, adults, kids } = useRoomContext();
  const room = rooms.find((r) => r.id === Number(id));

  if (!room) {
    return (
      <section>
        <ScrollToTop />
        <div className="container mx-auto max-w-7xl py-24 text-center">
          <p>Room not found.</p>
        </div>
      </section>
    );
  }

  const { name, description, facilities, price, imageLg } = room;
  const guests = +adults[0] + +kids[0];

  return (
    <section>
      <ScrollToTop />
      <div className="bg-room h-[560px] relative flex justify-center items-center bg-cover bg-center">
        <div className="absolute w-full h-full bg-black/70" />
        <h1 className="text-6xl text-white z-20 font-primary text-center">
          {name} Details
        </h1>
      </div>
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col lg:flex-row lg:gap-x-8 h-full py-24">
          <div className="w-full h-full text-justify">
            <h2 className="h2">{name}</h2>
            <p className="mb-8">{description}</p>
            <img className="mb-8 w-full" src={imageLg} alt={name} />
            <div className="mt-12">
              <h3 className="h3 mb-3"></h3>
              <p className="mb-12">
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
                Blanditiis accusantium sapiente quas quos explicabo, odit
                nostrum? Reiciendis illum dolor eos dicta. Illum vero at hic
                nostrum sint et quod porro.
              </p>
              {/* Facilities grid: icon + name from room.facilities (e.g. Wifi, Coffee, Bath). */}
              <div className="grid grid-cols-3 gap-6 mb-12">
                {facilities.map((item: Facility, index: number) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-x-3 flex-1"
                    >
                      <div className="text-3xl text-accent">
                        <Icon />
                      </div>
                      <div className="text-base">{item.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Sidebar: reservation form (dates + guests) and hotel rules. */}
          <div className="w-full lg:max-w-xs h-full">
            <div className="py-8 px-6 bg-accent/20 mb-12 w-full">
              <div className="flex flex-col space-y-4 mb-4 w-full">
                <h3>Your Reservation</h3>
                <div className="h-[60px] w-full">
                  <CheckIn popperPlacement="bottom-end" popperFullWidth />
                </div>
                <div className="h-[60px] w-full">
                  <CheckOut popperPlacement="bottom-end" popperFullWidth />
                </div>
                <div className="h-[60px] w-full">
                  <AdultsDropdown />
                </div>
                <div className="h-[60px] w-full">
                  <KidsDropdown />
                </div>
              </div>
              <button type="button" className="btn btn-lg btn-primary w-full">
                book now for ${price}
              </button>
              <PriceSummary
                legacyId={room.id}
                checkIn={checkIn}
                checkOut={checkOut}
                guests={guests}
              />
            </div>
            <div>
              <h3 className="h3">Hotel Rules</h3>
              <p className="mb-6 text-justify">
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Commodi
                dolores iure fugiat eligendi illo est, aperiam quasi distinctio
                necessitatibus suscipit nemo provident eaque voluptas earum.
              </p>
              <ul className="flex flex-col gap-y-4">
                {hotelRules.map(({ rules }, idx) => (
                  <li key={idx} className="flex items-center gap-x-4">
                    <FaCheck className="text-accent" />
                    {rules}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
