import { defineConfig } from "vitepress";

export default defineConfig({
  title: "PPT创造大师",
  description: "AI驱动的智能演示创作平台文档",
  lang: "zh-CN",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "技术栈", link: "/guide/tech-stack" },
      { text: "AI流程", link: "/guide/ai-pipeline" },
      { text: "API", link: "/guide/api-project" },
      { text: "账号", link: "/guide/ai-settings-auth" },
      { text: "命令", link: "/guide/commands" }
    ],
    sidebar: [
      {
        text: "项目指南",
        items: [
          { text: "项目概览", link: "/" },
          { text: "技术栈", link: "/guide/tech-stack" },
          { text: "AI流程", link: "/guide/ai-pipeline" },
          { text: "ASP.NET Core API", link: "/guide/api-project" },
          { text: "账号与 AI 设置", link: "/guide/ai-settings-auth" },
          { text: "命令", link: "/guide/commands" },
          { text: "国际化", link: "/guide/i18n" },
          { text: "主题与排版", link: "/guide/theme-typography" }
        ]
      }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/songjiqiu/SJQ-AI" }
    ]
  }
});
