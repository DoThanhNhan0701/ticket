// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InterviewCalendarGrid } from "@/features/recruitment/components/interview-calendar-grid";

afterEach(cleanup);
const row = {
  id: 7,
  id_interview: 60,
  title: "Lịch phỏng vấn có tiêu đề dài",
  start_date: "2030-12-10",
  time_start: "13:00:00",
  time_end: "14:00:00",
};
function props(view: "month" | "week" | "day") {
  return {
    days: [new Date(2030, 11, 10)],
    rows: [row],
    view,
    disabled: false,
    canViewCV: true,
    onCreate: vi.fn(),
    onAction: vi.fn(),
    onViewCV: vi.fn(),
  };
}
it.each(["month", "week", "day"] as const)(
  "%s keeps the full title accessible and sends the interview ID to every action",
  (view) => {
    const input = props(view);
    render(<InterviewCalendarGrid {...input} />);
    const card = within(screen.getByRole("article", { name: row.title }));
    expect(card.getByText(row.title).title).toBe(row.title);
    expect(card.getByText("13:00 – 14:00")).toBeTruthy();
    fireEvent.click(
      card.getByRole("button", { name: `Sửa lịch ${row.title}` }),
    );
    fireEvent.click(
      card.getByRole("button", { name: `Xóa lịch ${row.title}` }),
    );
    fireEvent.click(
      card.getByRole("button", { name: `Xem CV lịch ${row.title}` }),
    );
    expect(input.onAction.mock.calls).toEqual([
      ["interview", { ...row, id: 60 }],
      ["delete-interview", { ...row, id: 60 }],
    ]);
    expect(input.onViewCV).toHaveBeenCalledWith(60);
  },
);
it.each(["month", "week", "day"] as const)(
  "%s prevents actions while loading and hides CV access without permission",
  (view) => {
    const input = props(view);
    const { rerender } = render(<InterviewCalendarGrid {...input} disabled />);
    for (const button of within(screen.getByRole("article")).getAllByRole(
      "button",
      { name: /^(Sửa lịch|Xóa lịch|Xem CV lịch)/ },
    )) {
      expect(button.hasAttribute("disabled")).toBe(true);
      fireEvent.click(button);
    }
    expect(input.onAction).not.toHaveBeenCalled();
    expect(input.onViewCV).not.toHaveBeenCalled();
    rerender(<InterviewCalendarGrid {...input} canViewCV={false} />);
    expect(screen.queryByRole("button", { name: /^Xem CV lịch/ })).toBeNull();
  },
);
it("orders month cards by start time without mutating the supplied rows", () => {
  const rows = [
    row,
    { ...row, id_interview: 61, title: "Buổi sáng", time_start: "09:00:00" },
  ];
  render(<InterviewCalendarGrid {...props("month")} rows={rows} />);
  expect(
    screen
      .getAllByRole("article")
      .map((card) => card.getAttribute("aria-label")),
  ).toEqual(["Buổi sáng", row.title]);
  expect(rows[0]).toBe(row);
});
it("keeps actions available for a short interview and creates from the selected time slot", () => {
  const input = props("day");
  render(
    <InterviewCalendarGrid
      {...input}
      rows={[{ ...row, time_end: "13:15:00" }]}
    />,
  );
  expect(screen.getByText("13:00 – 13:15")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: `Sửa lịch ${row.title}` }),
  );
  expect(input.onAction).toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Tạo lịch 10/12/2030 14:30" }),
  );
  expect(input.onCreate).toHaveBeenCalledWith("2030-12-10", "14:30");
});

it.each(["month", "week", "day"] as const)(
  "%s shows all interviewers with full names and username fallback, independently of the creator",
  (view) => {
    render(
      <InterviewCalendarGrid
        {...props(view)}
        rows={[
          {
            ...row,
            user_create_name: "Người tạo lịch",
            data_user_interview: [
              {
                id: 1,
                last_name: "Nguyễn",
                first_name: "Văn An",
                username: "an01",
              },
              { id: 2, username: "binh02" },
            ],
          },
        ]}
      />,
    );
    const card = within(screen.getByRole("article", { name: row.title }));
    const people = card.getByRole("button", {
      name: "Người phỏng vấn: Nguyễn Văn An, binh02",
    });
    expect(people.textContent).toBe("Nguyễn Văn An+1");
    expect(card.queryByText("binh02")).toBeNull();
    expect(card.queryByText("Người tạo lịch")).toBeNull();
  },
);

it("shows interviewer names in compact cards and hides the summary when not assigned", () => {
  const input = props("day");
  const short = {
    ...row,
    time_end: "13:15:00",
    data_user_interview: [{ id: 1, username: "test-user" }],
  };
  const { rerender } = render(
    <InterviewCalendarGrid {...input} rows={[short]} />,
  );
  const people = screen.getByRole("button", {
    name: "Người phỏng vấn: test-user",
  });
  expect(people.textContent).toBe("test-user");
  expect(
    screen.getByRole("button", { name: `Sửa lịch ${row.title}` }),
  ).toBeTruthy();
  rerender(<InterviewCalendarGrid {...input} rows={[row]} />);
  expect(
    screen.queryByRole("button", { name: /^Người phỏng vấn:/ }),
  ).toBeNull();
});

it("resolves the calendar API's comma-separated interviewer IDs using user labels instead of showing raw IDs or the creator", () => {
  const { rerender } = render(
    <InterviewCalendarGrid
      {...props("month")}
      rows={[
        { ...row, user_interview: "42, 43,42", user_create_name: "Creator" },
      ]}
      interviewers={[
        { value: "42", label: "Nhân Đỗ" },
        { value: "43", label: "Trần Bình" },
      ]}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Người phỏng vấn: Nhân Đỗ, Trần Bình" })
      .textContent,
  ).toBe("Nhân Đỗ+1");
  rerender(
    <InterviewCalendarGrid
      {...props("month")}
      rows={[{ ...row, user_interview: "42" }]}
    />,
  );
  expect(
    screen.queryByRole("button", { name: /^Người phỏng vấn:/ }),
  ).toBeNull();
});

it("shows one name plus the remaining count and opens a tooltip with every interviewer", async () => {
  render(
    <InterviewCalendarGrid
      {...props("month")}
      rows={[{ ...row, user_interview: "1,2,3,4" }]}
      interviewers={[
        { value: "1", label: "nhandt" },
        { value: "2", label: "Bình" },
        { value: "3", label: "Chi" },
        { value: "4", label: "Dũng" },
      ]}
    />,
  );
  const trigger = screen.getByRole("button", {
    name: "Người phỏng vấn: nhandt, Bình, Chi, Dũng",
  });
  expect(trigger.textContent).toBe("nhandt+3");
  act(() => trigger.focus());
  const tooltip = await screen.findByRole("tooltip");
  expect(
    within(tooltip)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["nhandt", "Bình", "Chi", "Dũng"]);
  fireEvent.keyDown(trigger, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
});
