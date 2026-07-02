# Validation Notes

The package was created as a standalone skill directory and then zipped.

Suggested validation after unzipping into a skills library:

```bash
find .skills/apple-health-clone-react-native-skill -maxdepth 2 -type f | sort
sed -n '1,80p' .skills/apple-health-clone-react-native-skill/SKILL.md
```

Audit expectations:

- Folder name matches frontmatter `name`.
- Frontmatter has a description.
- Description includes `Use when` and `Do NOT use`.
- Skill contains Inputs, Outputs, Workflow, Quality Checklist, and References.
