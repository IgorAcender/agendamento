<?php defined('BASEPATH') or exit('No direct script access allowed');

class Migration_Add_photo_column_to_users_table extends EA_Migration
{
    public function up(): void
    {
        if (!$this->db->field_exists('photo', 'users')) {
            $fields = [
                'photo' => [
                    'type' => 'VARCHAR',
                    'constraint' => 512,
                    'null' => true,
                ],
            ];

            $this->dbforge->add_column('users', $fields);
        }
    }

    public function down(): void
    {
        if ($this->db->field_exists('photo', 'users')) {
            $this->dbforge->drop_column('users', 'photo');
        }
    }
}
