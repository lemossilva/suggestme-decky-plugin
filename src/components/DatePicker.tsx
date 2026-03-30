import { Focusable } from "@decky/ui";
import { useState, useCallback, useMemo } from "react";
import { FaChevronLeft, FaChevronRight, FaCalendarAlt, FaTimes } from "react-icons/fa";

interface DatePickerProps {
  value?: number;
  onChange: (timestamp: number | undefined) => void;
  label?: string;
  placeholder?: string;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_OF_WEEK = ["S", "M", "T", "W", "T", "F", "S"];

export function DatePicker({ value, onChange, label, placeholder = "Select date" }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value * 1000);
    return new Date();
  });
  const [focusedDay, setFocusedDay] = useState<number | null>(null);

  const selectedDate = value ? new Date(value * 1000) : null;

  const formatDate = (date: Date | null): string => {
    if (!date) return placeholder;
    return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const daysInMonth = useMemo(() => {
    return new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  }, [viewDate]);

  const firstDayOfMonth = useMemo(() => {
    return new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  }, [viewDate]);

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [daysInMonth, firstDayOfMonth]);

  const prevMonth = useCallback(() => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const nextMonth = useCallback(() => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const prevYear = useCallback(() => {
    setViewDate(prev => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
  }, []);

  const nextYear = useCallback(() => {
    setViewDate(prev => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
  }, []);

  const selectDay = useCallback((day: number) => {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 12, 0, 0);
    onChange(Math.floor(date.getTime() / 1000));
    setIsOpen(false);
  }, [viewDate, onChange]);

  const clearDate = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const isSelectedDay = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === viewDate.getMonth() &&
      selectedDate.getFullYear() === viewDate.getFullYear()
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === viewDate.getMonth() &&
      today.getFullYear() === viewDate.getFullYear()
    );
  };

  return (
    <div style={{ position: "relative" }}>
      {label && (
        <div style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>{label}</div>
      )}
      <Focusable
        flow-children="row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "100%",
        }}
      >
        <Focusable
          onActivate={() => setIsOpen(!isOpen)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 8px",
            backgroundColor: "#ffffff11",
            borderRadius: 6,
            cursor: "pointer",
            border: "2px solid transparent",
          }}
          onFocus={(e: any) => e.target.style.borderColor = "white"}
          onBlur={(e: any) => e.target.style.borderColor = "transparent"}
        >
          <span style={{ fontSize: 11, color: value ? "white" : "#666" }}>
            {formatDate(selectedDate)}
          </span>
          <FaCalendarAlt size={10} style={{ color: "#666" }} />
        </Focusable>
        {value !== undefined && (
          <Focusable
            onActivate={clearDate}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              backgroundColor: "#ff666633",
              borderRadius: 4,
              cursor: "pointer",
              border: "2px solid transparent",
              flexShrink: 0,
            }}
            onFocus={(e: any) => e.target.style.borderColor = "white"}
            onBlur={(e: any) => e.target.style.borderColor = "transparent"}
          >
            <FaTimes size={8} style={{ color: "#ff6666" }} />
          </Focusable>
        )}
      </Focusable>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 2,
            padding: 8,
            backgroundColor: "#1a1a1a",
            borderRadius: 6,
            border: "1px solid #333",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          {/* Navigation: stacked vertically for controller accessibility */}
          <Focusable
            flow-children="row"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}
          >
            <Focusable
              onActivate={prevYear}
              style={{
                padding: "3px 6px",
                backgroundColor: "#ffffff11",
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 9,
                border: "2px solid transparent",
              }}
              onFocus={(e: any) => e.target.style.borderColor = "white"}
              onBlur={(e: any) => e.target.style.borderColor = "transparent"}
            >
              «
            </Focusable>
            <Focusable
              onActivate={prevMonth}
              style={{
                padding: "3px 6px",
                backgroundColor: "#ffffff11",
                borderRadius: 3,
                cursor: "pointer",
                border: "2px solid transparent",
              }}
              onFocus={(e: any) => e.target.style.borderColor = "white"}
              onBlur={(e: any) => e.target.style.borderColor = "transparent"}
            >
              <FaChevronLeft size={8} />
            </Focusable>
            <div style={{ fontSize: 11, fontWeight: "bold", textAlign: "center", flex: 1 }}>
              {MONTHS_SHORT[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <Focusable
              onActivate={nextMonth}
              style={{
                padding: "3px 6px",
                backgroundColor: "#ffffff11",
                borderRadius: 3,
                cursor: "pointer",
                border: "2px solid transparent",
              }}
              onFocus={(e: any) => e.target.style.borderColor = "white"}
              onBlur={(e: any) => e.target.style.borderColor = "transparent"}
            >
              <FaChevronRight size={8} />
            </Focusable>
            <Focusable
              onActivate={nextYear}
              style={{
                padding: "3px 6px",
                backgroundColor: "#ffffff11",
                borderRadius: 3,
                cursor: "pointer",
                fontSize: 9,
                border: "2px solid transparent",
              }}
              onFocus={(e: any) => e.target.style.borderColor = "white"}
              onBlur={(e: any) => e.target.style.borderColor = "transparent"}
            >
              »
            </Focusable>
          </Focusable>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 1,
            marginBottom: 4,
          }}>
            {DAYS_OF_WEEK.map((day, i) => (
              <div key={i} style={{
                textAlign: "center",
                fontSize: 8,
                color: "#555",
                padding: 2,
              }}>
                {day}
              </div>
            ))}
          </div>

          <Focusable
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 1,
            }}
          >
            {calendarDays.map((day, idx) => (
              day === null ? (
                <div key={`empty-${idx}`} style={{ padding: 4 }} />
              ) : (
                <Focusable
                  key={day}
                  onActivate={() => selectDay(day)}
                  onFocus={() => setFocusedDay(day)}
                  onBlur={() => setFocusedDay(null)}
                  style={{
                    padding: 4,
                    textAlign: "center",
                    fontSize: 10,
                    borderRadius: 3,
                    cursor: "pointer",
                    backgroundColor: isSelectedDay(day)
                      ? "#4488aa"
                      : focusedDay === day
                        ? "#ffffff22"
                        : "transparent",
                    color: isSelectedDay(day)
                      ? "white"
                      : isToday(day)
                        ? "#4488aa"
                        : "#ccc",
                    fontWeight: isToday(day) ? "bold" : "normal",
                    border: focusedDay === day ? "1px solid white" : "1px solid transparent",
                  }}
                >
                  {day}
                </Focusable>
              )
            ))}
          </Focusable>

          <Focusable
            flow-children="row"
            style={{ marginTop: 6, display: "flex", gap: 4 }}
          >
            <Focusable
              onActivate={() => {
                const today = new Date();
                today.setHours(12, 0, 0, 0);
                onChange(Math.floor(today.getTime() / 1000));
                setIsOpen(false);
              }}
              style={{
                flex: 1,
                padding: "4px 8px",
                backgroundColor: "#ffffff11",
                borderRadius: 3,
                textAlign: "center",
                fontSize: 10,
                cursor: "pointer",
                border: "2px solid transparent",
              }}
              onFocus={(e: any) => e.target.style.borderColor = "white"}
              onBlur={(e: any) => e.target.style.borderColor = "transparent"}
            >
              Today
            </Focusable>
            <Focusable
              onActivate={() => { clearDate(); setIsOpen(false); }}
              style={{
                flex: 1,
                padding: "4px 8px",
                backgroundColor: "#ff666622",
                borderRadius: 3,
                textAlign: "center",
                fontSize: 10,
                color: "#ff6666",
                cursor: "pointer",
                border: "2px solid transparent",
              }}
              onFocus={(e: any) => e.target.style.borderColor = "white"}
              onBlur={(e: any) => e.target.style.borderColor = "transparent"}
            >
              Clear
            </Focusable>
            <Focusable
              onActivate={() => setIsOpen(false)}
              style={{
                flex: 1,
                padding: "4px 8px",
                backgroundColor: "#ffffff11",
                borderRadius: 3,
                textAlign: "center",
                fontSize: 10,
                cursor: "pointer",
                border: "2px solid transparent",
              }}
              onFocus={(e: any) => e.target.style.borderColor = "white"}
              onBlur={(e: any) => e.target.style.borderColor = "transparent"}
            >
              Close
            </Focusable>
          </Focusable>
        </div>
      )}
    </div>
  );
}
