# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Sparta Agent, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please send an email to: naikergomez0123@gmail.com

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You should receive a response within 72 hours acknowledging receipt.

## Scope

Sparta Agent runs locally and handles:
- API keys for AI providers (stored in an encrypted vault)
- File system access within your workspace
- Terminal command execution via the agent

Since the agent executes commands and accesses the filesystem, security issues in this area are treated with high priority.

## Disclosure Policy

We follow coordinated disclosure. Please allow a reasonable window for us to address the issue before public disclosure.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |
