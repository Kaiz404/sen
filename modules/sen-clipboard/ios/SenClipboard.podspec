Pod::Spec.new do |s|
  s.name           = 'SenClipboard'
  s.version        = '1.0.0'
  s.summary        = 'Copies text to the pasteboard as sensitive.'
  s.description    = 'Copies text to the pasteboard as sensitive.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
