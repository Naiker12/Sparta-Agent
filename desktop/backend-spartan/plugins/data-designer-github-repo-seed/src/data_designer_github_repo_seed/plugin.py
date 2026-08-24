
from data_designer.plugins.plugin import Plugin, PluginType

github_repo_seed_plugin = Plugin(
    impl_qualified_name = "data_designer_github_repo_seed.impl.GitHubRepoSeedReader",
    config_qualified_name = "data_designer_github_repo_seed.config.GitHubRepoSeedSource",
    plugin_type = PluginType.SEED_READER,
)
