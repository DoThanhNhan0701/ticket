import { requestTicketFixture } from "./requests";

export const requestDetailFixture = {
  ...requestTicketFixture,
  ticket_status: 2,
  username_create: "ticket-user",
  description: "Ghi chú yêu cầu",
  list_user_received: [{ username: "handler" }],
  attachment_files: {
    "image.png": "http://10.2.21.89:2001/media/image.png",
    "report.pdf": "/media/report.pdf",
  },
  comments: [
    {
      id: 1,
      username: "handler",
      created: "2026-10-20T10:00:00+07:00",
      content: "Đã nhận yêu cầu",
      att_file: {},
      item_comment: [
        {
          id: 2,
          username: "ticket-user",
          content: "Cảm ơn",
          created: "",
          att_file: {},
        },
      ],
    },
  ],
  data_item: {
    dataform: {
      header: [
        {
          title: "Phần tạo",
          editable: true,
          children: [
            {
              title: "Nội dung",
              dataIndex: "old-key",
              type: "text",
              required: true,
              editable: true,
            },
            { title: "Ngày bắt đầu", type: "date-text", editable: true },
          ],
        },
        {
          title: "Phần cập nhật sau",
          editable: false,
          children: [
            {
              title: "Ngày kết thúc",
              type: "date-text",
              editable: false,
              validate: { operator: ">=", target: "Ngày bắt đầu" },
            },
            { title: "Khoảng ngày", type: "range-date-text", editable: false },
          ],
        },
      ],
      data: [
        {
          key: 7,
          "old-key": "Dữ liệu đã lưu",
          "Ngày bắt đầu": "20/10/2026",
          "Ngày kết thúc": "21/10/2026",
          "Khoảng ngày": "20/10/2026 - 22/10/2026",
        },
      ],
    },
  },
};
